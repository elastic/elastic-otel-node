/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const assert = require('assert');
const http = require('http');
const https = require('https');
const {inspect} = require('util');
const zlib = require('zlib');
const TTLCache = require('@isaacs/ttlcache');
const {create, toBinary, fromBinary} = require('@bufbuild/protobuf');
const {Busboy} = require('@fastify/busboy');
const {stringify: uuidStringify} = require('uuid');
const {
    AgentToServerSchema,
    ServerToAgentSchema,
    ServerToAgentFlags,
    ServerCapabilities,
    AgentCapabilities,
    ServerErrorResponseType,
} = require('./generated/opamp_pb.js');
const {log} = require('./logging');
const {objFromKeyValues, isEqualUint8Array} = require('./utils');

/**
 * @typedef {import('./generated/opamp_pb.js').AgentToServer} AgentToServer
 * @typedef {import('./generated/opamp_pb.js').ServerToAgent} ServerToAgent
 * @typedef {import('./generated/opamp_pb.js').AgentConfigMap} AgentConfigMap
 * @typedef {import('./generated/anyvalue_pb.js').AnyValue} AnyValue
 * @typedef {import('./generated/anyvalue_pb.js').KeyValue} KeyValue
 */

// Default hostname to 'localhost', because that is what `DEFAULT_COLLECTOR_URL`
// uses in the OTel core exporter packages. Note that 'localhost' can by IPv6
// '::1' or IPv4 '127.0.0.1', which can potentially cause confusion.
const DEFAULT_HOSTNAME = 'localhost';
// DEFAULT_PORT is chosen to match that used in Elastic's `apmconfigextension`
// OTel collector extension:
//   https://github.com/elastic/opentelemetry-collector-components/blob/a86562325721addc0519bf8aa03423fe46a6516c/extension/apmconfigextension/factory.go#L44-L54
// and the opamp-go.git examples:
//   https://github.com/open-telemetry/opamp-go/blob/4e6e224c51cec39046bd2c2a7fa6b1867ab9c4ac/internal/examples/server/opampsrv/opampsrv.go#L59
const DEFAULT_PORT = 4320;
const DEFAULT_ENDPOINT_PATH = '/v1/opamp';

const BAD_MODES = {
    server_error_response_unknown:
        'Responds to valid AgentToServer requests with a ServerToAgent payload with a ServerErrorResponse of type UNKNOWN.',
    server_error_response_unavailable:
        'Responds to valid AgentToServer requests with a ServerToAgent payload with a ServerErrorResponse of type UNAVAILABLE and retryAfterNanoseconds of 42e9 (i.e. 42 seconds).',
};

/**
 * @param {http.ServerResponse} res
 */
function respondHttpErr(res, errMsg = 'Bad Request', errCode = 400) {
    res.writeHead(errCode, {
        'Content-Type': 'text/plain',
    });
    res.end(errMsg);
}

/**
 * @param {http.ServerResponse} res
 */
function respondHttp404(res, errMsg = '404 page not found') {
    res.writeHead(404, {
        'Content-Type': 'text/plain',
    });
    res.end(errMsg);
}

/**
 * AFAICT the OpAMP spec doesn't specify how to create this hash, but that's
 * fine.
 *
 * @param {AgentConfigMap} agentConfigMap
 * @return {Uint8Array}
 */
function hashAgentConfigMap(agentConfigMap) {
    const {createHash} = require('crypto');
    const hash = createHash('sha256');
    const keys = Object.keys(agentConfigMap.configMap);
    keys.sort();
    keys.forEach((key) => {
        hash.update(key);
        hash.update('\0');
        const agentConfigFile = agentConfigMap.configMap[key];
        hash.update(agentConfigFile.contentType);
        hash.update('\0');
        hash.update(agentConfigFile.body);
        hash.update('\0');
    });
    return hash.digest();
}

/**
 * A data class to store info about active agents, where "active" means the
 * server has received a recent heartbeat status from the client.
 */
class AgentInfo {
    constructor(data) {
        this.instanceUidStr = data.instanceUidStr;
        this.instanceUid = data.instanceUid;
        this.sequenceNum = data.sequenceNum;
        this.capabilities = data.capabilities;
        this.agentDescription = data.agentDescription;
        this.remoteConfigStatus = data.remoteConfigStatus;
        this.lastMsgTime = data.lastMsgTime;
    }

    /**
     * Return a JS object representation of `agentDescription.identifyingAttributes`.
     */
    getIdentifyingAttributes() {
        return objFromKeyValues(this.agentDescription.identifyingAttributes);
    }

    /**
     * Return a JS object representation of `agentDescription.nonIdentifyingAttributes`.
     */
    getNonIdentifyingAttributes() {
        return objFromKeyValues(this.agentDescription.nonIdentifyingAttributes);
    }

    [inspect.custom](depth, options, inspect) {
        const subset = {
            instanceUidStr: this.instanceUidStr,
            sequenceNum: this.sequenceNum,
            capabilities: this.capabilities,
            agentDescription_: {
                identifyingAttributes: objFromKeyValues(
                    this.agentDescription?.identifyingAttributes
                ),
                nonIdentifyingAttributes: objFromKeyValues(
                    this.agentDescription?.nonIdentifyingAttributes
                ),
            },
            remoteConfigStatus: this.remoteConfigStatus,
            lastMsgTime: this.lastMsgTime,
        };
        return `AgentInfo ${inspect(subset, {...options, depth: 10})}`;
    }
}

class MockOpAMPServer {
    /**
     * @param {object} [opts]
     * @param {string} [opts.logLevel] Optionally change the log level. This
     *      accepts any of the log level names supported by Bunyan. Default
     *      is "info".
     * @param {string} [opts.hostname]
     * @param {number} [opts.port] An port on which to listen. Default is 4320.
     * @param {any} [opts.ca] Override the trusted CA certificates.
     *      See https://nodejs.org/api/all.html#all_tls_tlscreatesecurecontextoptions
     *      If any of `ca`, `cert`, `key`, or `requestCert` are provided, then
     *      an *https* server is created.
     * @param {any} [opts.cert] TLS certificate chains in PEM format.
     *      See https://nodejs.org/api/all.html#all_tls_tlscreatesecurecontextoptions
     *      If any of `ca`, `cert`, `key`, or `requestCert` are provided, then
     *      an *https* server is created.
     * @param {any} [opts.key] Private keys in PEM format.
     *      See https://nodejs.org/api/all.html#all_tls_tlscreatesecurecontextoptions
     *      If any of `ca`, `cert`, `key`, or `requestCert` are provided, then
     *      an *https* server is created.
     * @param {boolean} [opts.requestCert] If `true` the server will request a
     *      certificate from clients. I.e., this enables mTLS.
     *      See https://nodejs.org/api/all.html#all_tls_tlscreateserveroptions-secureconnectionlistener
     *      If any of `ca`, `cert`, `key`, or `requestCert` are provided, then
     *      an *https* server is created.
     * @param {AgentConfigMap} [opts.agentConfigMap] An optional config map
     *      to offer to clients with the `AcceptsRemoteConfig` capability.
     *      For example:
     *          const config = {foo: 42};
     *          const body = Buffer.from(JSON.stringify(config), 'utf8');
     *          const agentConfigMap = {
     *              configMap: {
     *                  '': {body, contentType: 'application/json'}
     *              }
     *          };
     *      Notes:
     *      - This structure is a bit painful. Could hide some of the details.
     *      - MockOpAMPServer does not support providing different remote config
     *        depending on client/agent identifying attributes, though that
     *        would be an interesting feature to add.
     * @param {boolean} [opts.testMode] Enable "test mode". This makes the
     *      `.test*` methods functional. Typically this is useful when using
     *      this class directly in a test suite. Default false. Note that
     *      requests and responses are cached in test mode, so this is
     *      effectively a memory leak if run for a long time in test mode.
     * @param {string} [opts.badMode] Enable a specific "bad" mode where the
     *      server responds in various bad ways. See `BAD_MODES` for supported
     *      values of `badMode`.
     */
    constructor(opts) {
        opts = opts ?? {};
        if (opts.logLevel != null) {
            log.level(opts.logLevel);
        }

        this._hostname = opts.hostname ?? DEFAULT_HOSTNAME;
        this._port = opts.port ?? DEFAULT_PORT;
        this._endpointPath = DEFAULT_ENDPOINT_PATH;
        if (opts.agentConfigMap) {
            this.setAgentConfigMap(opts.agentConfigMap);
        }
        const serverOpts = {};
        this._protocol = 'http:';
        for (let tlsOptName of ['ca', 'cert', 'key', 'requestCert']) {
            if (opts[tlsOptName]) {
                serverOpts[tlsOptName] = opts[tlsOptName];
                this._protocol = 'https:';
            }
        }
        const protoMod = this._protocol === 'http:' ? http : https;
        this._server = protoMod.createServer(
            serverOpts,
            this._onRequest.bind(this)
        );
        this._started = false;

        const HEARTBEAT_INTERVAL = 30 * 1000;
        this._activeAgents = new TTLCache({
            max: 10000,
            ttl: 5 * HEARTBEAT_INTERVAL,
            dispose: (_value, instanceUidStr, reason) => {
                log.info({instanceUidStr, reason}, 'remove active agent');
            },
        });

        if (opts.testMode) {
            this._testMode = true;
            this._testRequests = [];
        }
        if (opts.badMode) {
            if (!(opts.badMode in BAD_MODES)) {
                throw new Error(`unknown "badMode" value: "${opts.badMode}"`);
            }
            this._badMode = opts.badMode;
        }
    }

    /**
     * Set the data used by the server to provide `remoteConfig` to agents.
     *
     * `agentConfigMap` is of the form:
     *      {
     *          configMap: {
     *              // Zero or more entries in `configMap`.
     *              'some-key': {
     *                  body: <Uint8Array of config file content>,
     *                  contentType: <string>
     *              }
     *          }
     *      }
     *
     * Example usage:
     *      const config = { deactivate_all_instrumentations: 'true' };
     *      opampServer.setAgentConfigMap({
     *        configMap: {
     *          elastic: {
     *            body: Buffer.from(JSON.stringify(config), 'utf8'),
     *            contentType: 'application/json',
     *          }
     *        }
     *      });
     */
    setAgentConfigMap(agentConfigMap) {
        this._agentConfigMap = agentConfigMap;
        this._agentConfigMapHash = hashAgentConfigMap(agentConfigMap);
    }

    get endpoint() {
        assert.ok(
            this._started,
            'MockOpAMPServer must be started to have an `endpoint`.'
        );
        return this._endpoint;
    }

    async start() {
        return new Promise((resolve, reject) => {
            this._server.listen(this._port, this._hostname, () => {
                const addr = this._server.address();
                if (addr.family === 'IPv6') {
                    this._endpointOrigin = `${this._protocol}//[${addr.address}]:${addr.port}`;
                } else {
                    this._endpointOrigin = `${this._protocol}//${addr.address}:${addr.port}`;
                }
                this._endpoint = this._endpointOrigin + this._endpointPath;
                log.info(`OpAMP server listening at ${this._endpoint}`);
                resolve();
            });
            this._server.on('error', reject);
            this._started = true;
        });
    }

    async close() {
        if (this._started) {
            return new Promise((resolve, reject) => {
                this._server.close((err) => {
                    err ? reject(err) : resolve();
                });
            });
        }
    }

    /**
     * Lookup an active agent by `instanceUid`.
     *
     * MockOpAMPServer maintains a set of "active" agents. "Active" means that
     * the agent (a.k.a. OpAMP client) has sent a message recently -- where
     * "recent" is currently hardcoded to 2m30s (5 times the default 30s
     * heartbeat interval). "Agent" is an `AgentInfo` object with cached
     * data from the client `AgentToServer` messages.
     *
     * @param {Uint8Array} instanceUid
     * @returns {AgentInfo | undefined}
     */
    getActiveAgent(instanceUid) {
        const instanceUidStr = uuidStringify(instanceUid);
        return this._activeAgents.get(instanceUidStr);
    }

    /**
     * Clear any cached data. This is useful when starting a test.
     */
    testReset() {
        assert.ok(this._testMode, 'must set testMode:true option');
        this._activeAgents.clear();
        this._testRequests = [];
    }

    /**
     * Return a (shallow) copy of received requests.
     *
     * This returns an array of objects of the form:
     *      {
     *          req: <incoming HTTP request>,
     *          a2s: <AgentToServer protobuf message>,
     *          res: <outgoing HTTP response>,
     *          s2a: <ServerToAgent protobuf message>,
     *          err: <Error instance if there was an error>,
     *      }
     * If a request fails, some of these fields will not be present.
     */
    testGetRequests() {
        assert.ok(this._testMode, 'must set testMode:true option');
        return this._testRequests.slice();
    }

    _testNoteRequest({
        req,
        res = undefined,
        a2s = undefined,
        s2a = undefined,
        err = undefined,
    }) {
        function pick(obj, propNames) {
            if (obj === undefined) {
                return undefined;
            }
            const picked = {};
            for (let n of propNames) {
                if (n in obj) {
                    picked[n] = obj[n];
                }
            }
            return picked;
        }

        if (this._testMode) {
            const datum = {
                req: pick(req, ['method', 'path', 'headers']),
                res: pick(res, ['statusCode', '_header']),
                a2s,
                s2a,
                err,
            };
            this._testRequests.push(datum);
        }
    }

    /**
     * SetAgentConfigMap
     * POST /api/agentConfigMap
     *
     * This *assumes* the content-type is JSON, but it doesn't check the
     * header. This handler also isn't careful to check that the format of the
     * given data is correct. Some curl examples:
     *
     *  # With multipart-form data.
     *  curl -i http://127.0.0.1:4320/api/agentConfigMap -F 'elastic={"logging_level":"debug"}'
     *  curl -i http://127.0.0.1:4320/api/agentConfigMap -F 'elastic={}'
     *  curl -i http://127.0.0.1:4320/api/agentConfigMap -F 'elastic=@test/fixtures/agent-config.json'
     *  curl -i http://127.0.0.1:4320/api/agentConfigMap -F 'elastic=@foo.yaml;type=application/yaml'
     *
     *  # With form-urlencoded data (does not support setting 'contentType').
     *  curl -i http://127.0.0.1:4320/api/agentConfigMap -d 'elastic={"logging_level":"debug"}'
     *  curl -i http://127.0.0.1:4320/api/agentConfigMap --data-urlencode elastic@./config.json
     *  curl -i http://127.0.0.1:4320/api/agentConfigMap -d 'elastic={}'
     *
     *  # set logging_level=debug for "elastic" key
     *  curl -i http://127.0.0.1:4320/api/agentConfigMap -H content-type:application/json \
     *      -d '{"elastic": {"body": "{\"logging_level\":\"debug\"}", "contentType": "application/json"}}'
     *  # empty "elastic" config
     *  curl -i http://127.0.0.1:4320/api/agentConfigMap -H content-type:application/json \
     *      -d '{"elastic": {"body": "{}"}}'
     */
    _testApiSetAgentConfigMap(req, res) {
        req.on('error', (err) => {
            log.warn(err, 'error on req');
            respondHttpErr(res, err.message);
        });

        let agentConfigMap = {configMap: {}};
        const finish = () => {
            log.trace({agentConfigMap}, 'SetAgentConfigMap');
            this.setAgentConfigMap(agentConfigMap);
            res.writeHead(204);
            res.end();
            log.debug({req, res}, 'test API request: SetAgentConfigMap');
        };

        const ct = req.headers['content-type'];
        if (ct === 'application/json') {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                try {
                    const data = JSON.parse(body);
                    for (let key of Object.keys(data)) {
                        agentConfigMap.configMap[key] = {
                            body: Buffer.from(data[key].body),
                            contentType:
                                data[key].contentType || 'application/json',
                        };
                    }
                } catch (err) {
                    respondHttpErr(res, err.message, 400);
                    return;
                }
                finish();
            });
        } else {
            // Try busboy to handle form-urlencoded form and multipart/form-data.
            let busboy;
            try {
                busboy = new Busboy({headers: req.headers});
            } catch (ctErr) {
                respondHttpErr(
                    res,
                    `unsupported Content-Type, got ${
                        req.headers['content-type'] ?? '<empty>'
                    }`
                );
                return;
            }
            busboy.on(
                'file',
                (fieldname, file, filename, encoding, mimetype) => {
                    // curl http://127.0.0.1:4320/api/agentConfigMap -F ...
                    if (!mimetype || mimetype === 'application/octet-stream') {
                        mimetype = 'application/json';
                    }
                    const chunks = [];
                    file.on('data', (chunk) => chunks.push(chunk));
                    file.on('end', () => {
                        const body = Buffer.concat(chunks);
                        agentConfigMap.configMap[fieldname] = {
                            body,
                            contentType: mimetype,
                        };
                    });
                }
            );
            busboy.on(
                'field',
                (
                    fieldname,
                    val,
                    _fieldnameTruncated,
                    _valTruncated,
                    _encoding,
                    mimetype
                ) => {
                    // curl http://127.0.0.1:4320/api/agentConfigMap -d ...
                    agentConfigMap.configMap[fieldname] = {
                        body: Buffer.from(val),
                        contentType: 'application/json',
                    };
                }
            );
            busboy.on('finish', () => {
                finish();
            });
            req.pipe(busboy);
        }
    }

    _onRequest(req, res) {
        const u = new URL(req.url, this._endpointOrigin);

        // Handle non-OpAMP route "POST /api/agentConfigMap". This route is only
        // enabled if `testMode==true`. It is not a part of the OpAMP spec.
        if (
            this._testMode &&
            req.method == 'POST' &&
            u.pathname == '/api/agentConfigMap'
        ) {
            this._testApiSetAgentConfigMap(req, res);
            return;
        }

        // Basic HTTP request validations.
        if (u.pathname !== this._endpointPath) {
            respondHttp404(res);
            this._testNoteRequest({req, res});
            return;
        }
        if (
            req.method == 'GET' &&
            req.headers.connection?.trim()?.toLowerCase() == 'upgrade'
        ) {
            respondHttpErr(
                res,
                'Connection upgrade is not supported. mockopampserver does not implement the OpAMP WebSockets transport.',
                501
            );
            this._testNoteRequest({req, res});
            return;
        }
        if (req.method !== 'POST') {
            // Not using HTTP 405, because a 'GET' will eventually be
            // allowed for connection upgrade to websocket.
            respondHttpErr(res);
            this._testNoteRequest({req, res});
            return;
        }
        if (req.headers['content-type'] !== 'application/x-protobuf') {
            respondHttpErr(
                res,
                `invalid Content-Type, expect "application/x-protobuf", got ${
                    req.headers['content-type'] ?? '<empty>'
                }`
            );
            this._testNoteRequest({req, res});
            return;
        }

        // Handle possible gzip compression;
        let instream;
        switch (req.headers['content-encoding']) {
            case undefined:
                instream = req;
                break;
            case 'gzip':
                instream = req.pipe(zlib.createGunzip());
                break;
            default:
                respondHttpErr(
                    res,
                    `unsupported Content-Encoding: ${req.headers['content-encoding']}`,
                    415
                );
                this._testNoteRequest({req, res});
                return;
        }

        const chunks = [];
        instream.on('data', (chunk) => chunks.push(chunk));
        instream.on('error', (err) => {
            log.warn(err, 'error on instream');
            respondHttpErr(res, err.message);
            this._testNoteRequest({req, res, err});
        });
        instream.on('end', () => {
            const reqBuffer = Buffer.concat(chunks);
            let a2s;
            try {
                a2s = fromBinary(AgentToServerSchema, reqBuffer);
            } catch (err) {
                log.info(err, 'deserialize AgentToServer error');
                respondHttpErr(res, err.message);
                this._testNoteRequest({req, res, err});
                return;
            }

            if (a2s.instanceUid.length !== 16) {
                respondHttpErr(
                    res,
                    `invalid length of instanceUid: ${a2s.instanceUid.length}`
                );
                this._testNoteRequest({req, res, a2s});
                return;
            }
            // TODO: validate sequenceNum is set
            // TODO: validate capabilities

            let s2a;
            if (this._badMode === 'server_error_response_unknown') {
                const resData = {
                    instanceUid: a2s.instanceUid,
                    errorResponse: {
                        type: ServerErrorResponseType.ServerErrorResponseType_Unknown,
                        errorMessage: 'some unknown error',
                    },
                };
                s2a = create(ServerToAgentSchema, resData);
            } else if (this._badMode === 'server_error_response_unavailable') {
                const resData = {
                    instanceUid: a2s.instanceUid,
                    errorResponse: {
                        type: ServerErrorResponseType.ServerErrorResponseType_Unavailable,
                        errorMessage: 'some reason',
                        // TODO: I'm not sure `Details` is correct here.
                        Details: {
                            case: 'retryInfo',
                            value: {
                                retryAfterNanoseconds: 42_000_000_000n,
                            },
                        },
                    },
                };
                s2a = create(ServerToAgentSchema, resData);
            } else {
                try {
                    s2a = this._processAgentToServer(a2s);
                } catch (err) {
                    log.debug({err, req, res}, '_processAgentToServer threw');
                    respondHttpErr(
                        res,
                        `could not process AgentToServer: ${err.message}`,
                        500
                    );
                    this._testNoteRequest({req, res, a2s});
                    return;
                }
            }

            // TODO: compress if `Accept-Encoding: gzip`
            const resBody = toBinary(ServerToAgentSchema, s2a);
            res.writeHead(200, {
                'Content-Type': 'application/x-protobuf',
                'Content-Length': resBody.length,
            });
            res.end(resBody);

            req.body = a2s; // for logging 'req' serializer
            res.body = s2a; // for logging 'res' serializer
            log.debug({req, res}, 'request');
            this._testNoteRequest({req, res, a2s, s2a});
        });
    }

    /**
     * @param {AgentToServer} a2s
     * @returns {ServerToAgent}
     */
    _processAgentToServer(a2s) {
        let instanceUidStr;
        try {
            instanceUidStr = uuidStringify(a2s.instanceUid);
        } catch (err) {
            throw new Error(
                `could not stringify 'instanceUid' to a UUID: err="${
                    err.message
                }", a2s.instanceUid=${inspect(Buffer.from(a2s.instanceUid))}`
            );
        }
        const reportedFullState = Boolean(
            a2s.agentDescription &&
                (!(
                    a2s.capabilities &
                    BigInt(
                        AgentCapabilities.AgentCapabilities_ReportsRemoteConfig
                    )
                ) ||
                    a2s.remoteConfigStatus)
        );
        const resData = {
            instanceUid: a2s.instanceUid,
            flags: 0,
            capabilities:
                ServerCapabilities.ServerCapabilities_AcceptsStatus |
                ServerCapabilities.ServerCapabilities_OffersRemoteConfig,
        };

        // Create or update an agent record for this agent. Also decide if
        // need to request ReportFullState.
        let agent = this._activeAgents.get(instanceUidStr);
        if (!agent) {
            agent = new AgentInfo({
                instanceUidStr,
                instanceUid: a2s.instanceUid,
                sequenceNum: a2s.sequenceNum,
                capabilities: a2s.capabilities,
                agentDescription: a2s.agentDescription,
                remoteConfigStatus: a2s.remoteConfigStatus,
                lastMsgTime: Date.now(),
            });
            this._activeAgents.set(instanceUidStr, agent);
            log.info({agent}, 'new active agent');
            if (!reportedFullState) {
                log.debug({instanceUidStr}, 'request ReportFullState');
                resData.flags |=
                    ServerToAgentFlags.ServerToAgentFlags_ReportFullState;
            }
        } else {
            if (
                a2s.sequenceNum !== agent.sequenceNum + 1n &&
                !reportedFullState
            ) {
                log.debug(
                    {instanceUidStr, agentSeqNum: agent.sequenceNum},
                    'request ReportFullState (sequenceNum missed)'
                );
                resData.flags |=
                    ServerToAgentFlags.ServerToAgentFlags_ReportFullState;
            }
            agent.sequenceNum = a2s.sequenceNum;
            agent.capabilities = a2s.capabilities;
            if (a2s.agentDescription) {
                agent.agentDescription = a2s.agentDescription;
            }
            if (a2s.remoteConfigStatus) {
                agent.remoteConfigStatus = a2s.remoteConfigStatus;
            }
            agent.lastMsgTime = Date.now();
            this._activeAgents.set(instanceUidStr, agent);
        }

        // Offer remote config, if:
        // - the agent accepts remote config
        // - the server has remote config for this agent
        // - the RemoteConfigStatus.lastRemoteConfigHash differs, if have
        //   remoteConfigStatus from the agent
        const acceptsRemoteConfig =
            a2s.capabilities &
            BigInt(AgentCapabilities.AgentCapabilities_AcceptsRemoteConfig);
        if (
            acceptsRemoteConfig &&
            this._agentConfigMap &&
            (!agent.remoteConfigStatus ||
                !isEqualUint8Array(
                    agent.remoteConfigStatus.lastRemoteConfigHash,
                    this._agentConfigMapHash
                ))
        ) {
            resData.remoteConfig = {
                config: this._agentConfigMap,
                configHash: this._agentConfigMapHash,
            };
        }

        return create(ServerToAgentSchema, resData);
    }
}

module.exports = {
    DEFAULT_HOSTNAME,
    MockOpAMPServer,
};
