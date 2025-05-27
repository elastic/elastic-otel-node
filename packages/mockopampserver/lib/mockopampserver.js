/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const assert = require('assert');
const http = require('http');
const {inspect} = require('util');
const zlib = require('zlib');
const TTLCache = require('@isaacs/ttlcache');
const {create, toBinary, fromBinary} = require('@bufbuild/protobuf');
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

/**
 * @typedef {import('./generated/opamp_pb.js').AgentToServer} AgentToServer
 * @typedef {import('./generated/opamp_pb.js').ServerToAgent} ServerToAgent
 * @typedef {import('./generated/anyvalue_pb.js').AnyValue} AnyValue
 * @typedef {import('./generated/anyvalue_pb.js').KeyValue} KeyValue
 */

// Default hostname to 'localhost', because that is what `DEFAULT_COLLECTOR_URL`
// uses in the OTel core exporter packages. Note that 'localhost' can by IPv6
// '::1' or IPv4 '127.0.0.1', which can potentially cause confusion.
const DEFAULT_HOSTNAME = 'localhost';
// DEFAULT_PORT is close to the OTLP 4317 port, and currently unassigned
// https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.xhtml?&page=81
// This isn't a strong argument for using this port.
const DEFAULT_PORT = 4315;
const DEFAULT_ENDPOINT_PATH = '/v1/opamp';

const BAD_MODES = [
    'server_error_response_unknown',
    'server_error_response_unavailable',
];

/**
 * @param {http.OutgoingMessage} res
 */
function respondHttpErr(res, errMsg = 'Bad Request', errCode = 400) {
    res.writeHead(errCode, {
        'Content-Type': 'text/plain',
    });
    res.end(errMsg);
}
function respondHttp404(res, errMsg = '404 page not found') {
    res.writeHead(404, {
        'Content-Type': 'text/plain',
    });
    res.end(errMsg);
}

/**
 * (Copied from "packages/opamp-client-node/lib/utils.js".)
 *
 * Convert a `KeyValue[]` type to a JS object.
 * For example, AgentDescription.identifying_attributes are of type `KeyValue[]`.
 * Using that type directly is a huge PITA.
 *
 * @param {KeyValue[]}
 * @returns {object}
 */
function objFromKeyValues(keyValues) {
    const obj = {};
    if (keyValues == null) {
        return obj;
    }
    for (let i = 0; i < keyValues.length; i++) {
        const kv = keyValues[i];
        obj[kv.key] = valFromAnyValue(kv.value);
    }
    return obj;
}

/**
 * @param {AnyValue}
 * @returns {any}
 */
function valFromAnyValue(anyValue) {
    let val;
    switch (anyValue.value.case) {
        case 'stringValue':
        case 'boolValue':
        case 'doubleValue':
        case 'bytesValue':
            val = anyValue.value.value;
            break;
        case 'intValue':
            val = anyValue.value.value;
            break;
        case 'arrayValue':
            val = anyValue.value.value.values.map(valFromAnyValue);
            break;
        case 'kvlistValue':
            val = objFromKeyValues(anyValue.value.value.values);
            break;
        // default: val is undefined
    }
    return val;
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
     * @param {number} [opts.port] An port on which to listen. Default is 4315.
     * @param {boolean} [opts.testMode] Enable "test mode". This makes the
     *      `.test*` methods functional. Typically this is useful when using
     *      this class directly in a test suite. Default false. Note that
     *      requests and responses are cached in test mode, so this is
     *      effectively a memory leak if run for a long time in test mode.
     * @param {string} [opts.hostname]
     * @param {string} [opts.badMode] Enable a specific "bad" mode where the
     *      server responds in various bad ways. Supported badMode values:
     *      - server_error_response_unknown
     */
    constructor(opts) {
        opts = opts ?? {};
        if (opts.logLevel != null) {
            log.level(opts.logLevel);
        }

        this._hostname = opts.hostname ?? DEFAULT_HOSTNAME;
        this._port = opts.port ?? DEFAULT_PORT;
        this._endpointPath = DEFAULT_ENDPOINT_PATH;
        this._server = http.createServer(this._onRequest.bind(this));
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
            if (!BAD_MODES.includes(opts.badMode)) {
                throw new Error(`unknown "badMode" value: "${opts.badMode}"`);
            }
            this._badMode = opts.badMode;
        }
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
                    this._endpointOrigin = `http://[${addr.address}]:${addr.port}`;
                } else {
                    this._endpointOrigin = `http://${addr.address}:${addr.port}`;
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

    _onRequest(req, res) {
        // Basic HTTP request validations.
        const u = new URL(req.url, this._endpointOrigin);
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
        if (req.headers['content-encoding'] === 'gzip') {
            instream = req.pipe(zlib.createGunzip());
        } else if (req.headers['content-encoding'] === 'deflate') {
            // Go agent uses "deflate"
            instream = req.pipe(zlib.createInflate());
        }

        const chunks = [];
        instream.on('data', (chunk) => chunks.push(chunk));
        instream.on('error', (err) => {
            log.warn(err, 'error on instream');
            respondHttpErr(res, err.message);
            this._testNoteRequest({req, res});
        });
        instream.on('end', () => {
            const reqBuffer = Buffer.concat(chunks);
            let a2s;
            try {
                a2s = fromBinary(AgentToServerSchema, reqBuffer);
            } catch (err) {
                log.info(err, 'deserialize AgentToServer error');
                respondHttpErr(res, err.message);
                this._testNoteRequest({req, res});
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
                s2a = this._processAgentToServer(a2s);
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
     * @param {AgentToServer} s2a
     * @returns {ServerToAgent}
     */
    _processAgentToServer(a2s) {
        const instanceUidStr = uuidStringify(a2s.instanceUid);
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

        // TODO: Offer remote config, if:
        // - the agent accepts remote config
        // - the server has remote config for this agent
        // - the RemoteConfigStatus.lastRemoteConfigHash differs, if have
        //   remoteConfigStatus from the agent

        return create(ServerToAgentSchema, resData);
    }
}

module.exports = {
    DEFAULT_HOSTNAME,
    MockOpAMPServer,
};
