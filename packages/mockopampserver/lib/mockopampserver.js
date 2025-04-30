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
 * Convert a `KeyValue[]` type to a JS object.
 * For example, AgentDescription.identifying_attributes are of type `KeyValue[]`.
 * Using that type directly is a huge PITA.
 *
 * Dev Note: For interest, compare to the reverse `keyValuesFromObj()` in
 * the client ("packages/opamp-client-node/...").
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
     * @param {string} [opts.hostname]
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

    _onRequest(req, res) {
        // Basic HTTP request validations.
        const u = new URL(req.url, this._endpointOrigin);
        if (u.pathname !== this._endpointPath) {
            respondHttp404(res);
            return;
        }
        if (
            req.method == 'GET' &&
            req.headers.connection?.trim()?.toLowerCase() == 'upgrade'
        ) {
            respondHttpErr(
                res,
                'Connection upgrade is not supported. mockapmserver does not implement the OpAMP WebSockets transport.',
                501
            );
        }
        if (req.method !== 'POST') {
            // Not using HTTP 405, because a 'GET' will eventually be
            // allowed for connection upgrade to websocket.
            respondHttpErr(res);
            return;
        }
        if (req.headers['content-type'] !== 'application/x-protobuf') {
            respondHttpErr(
                res,
                `invalid Content-Type, expect "application/x-protobuf", got ${
                    req.headers['content-type'] ?? '<empty>'
                }`
            );
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
        });
        instream.on('end', () => {
            const reqBuffer = Buffer.concat(chunks);
            let a2s;
            try {
                a2s = fromBinary(AgentToServerSchema, reqBuffer);
            } catch (err) {
                log.info(err, 'deserialize AgentToServer error');
                respondHttpErr(res, err.message);
                return;
            }

            if (a2s.instanceUid.length !== 16) {
                respondHttpErr(
                    res,
                    `invalid length of instanceUid: ${a2s.instanceUid.length}`
                );
                return;
            }

            const s2a = this._processAgentToServer(a2s);

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
