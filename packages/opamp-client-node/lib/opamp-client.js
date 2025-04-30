/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const assert = require('assert');

const {
    parse: uuidParse,
    stringify: uuidStringify,
    v7: uuidv7,
} = require('uuid');
const undici = require('undici');
const {create, toBinary, fromBinary} = require('@bufbuild/protobuf');

const {
    AgentCapabilities,
    AgentToServerSchema,
    ServerToAgentSchema,
    RemoteConfigStatusSchema,
    RemoteConfigStatuses,
    ServerCapabilities,
    ServerToAgentFlags,
    AgentDescriptionSchema,
} = require('./generated/opamp_pb');
const {KeyValueSchema} = require('./generated/anyvalue_pb');
const {NoopLogger} = require('./logging');

/**
 * @typedef {import('./generated/opamp_pb.js').AgentDescription} AgentDescription
 * @typedef {import('./generated/opamp_pb.js').AgentToServer} AgentToServer
 * @typedef {import('./generated/opamp_pb.js').RemoteConfigStatus} RemoteConfigStatus
 * @typedef {import('./generated/opamp_pb.js').ServerToAgent} ServerToAgent
 * @typedef {import('./generated/opamp_pb.js').AgentRemoteConfig} AgentRemoteConfig
 * @typedef {import('./generated/anyvalue_pb.js').KeyValue} KeyValue
 * @typedef {import('./generated/anyvalue_pb.js').AnyValue} AnyValue
 * @typedef {import('./generated/anyvalue_pb.js').ArrayValue} ArrayValue
 */

const PKG = require('../package.json');
const USER_AGENT = `${PKG.name}/${PKG.version}`;
const DEFAULT_HEADERS = {
    'User-Agent': USER_AGENT,
};

// DEFAULT_CAP are the default, always-on capabilities.
const DEFAULT_CAP = BigInt(
    AgentCapabilities.AgentCapabilities_ReportsStatus |
        AgentCapabilities.AgentCapabilities_ReportsHeartbeat
);
// ALL_SUPPORTED_CAP is the subset of OpAMP client capabilities supported by
// this implementation.
const ALL_SUPPORTED_CAP = BigInt(
    AgentCapabilities.AgentCapabilities_ReportsStatus |
        AgentCapabilities.AgentCapabilities_ReportsHeartbeat |
        AgentCapabilities.AgentCapabilities_AcceptsRemoteConfig |
        AgentCapabilities.AgentCapabilities_ReportsRemoteConfig
);
const UNSUPPORTED_CAP_MASK = ALL_SUPPORTED_CAP ^ (2n ** 64n - 1n);

const DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 30;
// A 10ms heartbeat interval is crazy low, but might be useful for testing.
const MIN_HEARTBEAT_INTERVAL_SECONDS = 0.1;

// Randomly adjust to given numeric value by +/- 10%.
function jitter(val) {
    assert.equal(typeof val, 'number');
    const range = val * 0.1; // +/- 10% jitter
    const jit = range * 2 * Math.random() - range;
    return val + jit;
}

function normalizeInstanceUid(input) {
    if (typeof input === 'string') {
        return uuidParse(input);
    }
    assert.equal(input.length, 16);
    return input;
}

function genUuidv7() {
    const b = new Uint8Array(16);
    uuidv7(null, b);
    return b;
}

// Serialize some commonly logged objects for logging. The default repr is
// too wordy for the log.
function logserInstanceUid(instanceUid) {
    if (!instanceUid) {
        return instanceUid;
    }
    return uuidStringify(instanceUid);
}
function logserS2A(s2a) {
    if (!s2a) {
        return s2a;
    }
    return {
        ...s2a,
        instanceUid: logserInstanceUid(s2a.instanceUid),
    };
}
function logserA2S(a2s) {
    if (!a2s) {
        return a2s;
    }
    return {
        ...a2s,
        instanceUid: logserInstanceUid(a2s.instanceUid),
    };
}

/**
 * Take a given `capabilities` option and validate it (error on invalid type,
 * error on specifying unsupported capabilities) and normalize it (add the
 * always on default capabilities).
 */
function normalizeCapabilities(input) {
    if (input == null) {
        return DEFAULT_CAP;
    } else if (typeof input !== 'bigint' && typeof input !== 'number') {
        throw new Error(`'capabilities' must be a BigInt, got ${typeof input}`);
    } else {
        let cap = BigInt(input) | DEFAULT_CAP;
        const unsupported = cap & UNSUPPORTED_CAP_MASK;
        if (unsupported) {
            throw new Error(
                `'capabilities' includes values unsupported by this OpAMPClient implementation: 0b${unsupported.toString(
                    2
                )}`
            );
        }
        return cap;
    }
}

function normalizeHeartbeatIntervalSeconds(input) {
    if (input == null) {
        return DEFAULT_HEARTBEAT_INTERVAL_SECONDS;
    } else if (typeof input !== 'number') {
        throw new Error(
            `invalid "heartbeatIntervalSeconds" value type: ${typeof input}`
        );
    } else if (input <= MIN_HEARTBEAT_INTERVAL_SECONDS) {
        throw new Error(`"heartbeatIntervalSeconds" is too low: ${input}`);
    } else {
        return input;
    }
}

function isEqualUint8Array(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

/**
 * Convert a JS object to the `KeyValue[]` type.
 *
 * @returns {KeyValue[]}
 */
function keyValuesFromObj(obj) {
    const keyValues = [];
    if (obj == null) {
        return keyValues;
    }

    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const val = obj[key];
        if (val !== undefined) {
            keyValues.push(
                create(KeyValueSchema, {key: key, value: anyValueFromVal(val)})
            );
        }
    }

    return keyValues;
}

/**
 * Convert a JS value `val` into the `MessageInit<AnyValue>` that makes
 * @bufbuild/protobuf happy.
 *
 * Dev Note: this *would* JSDoc `returns {Partial<AnyValue>}` but I cannot
 * get that to work with ArrayValue and KeyValueList.
 */
function anyValueFromVal(val) {
    const typ = typeof val;

    // Dev Note: Compare to `toAnyValue` in opentelemetry-js/experimental/packages/otlp-transformer/src/common/internal.ts.
    if (typ === 'string') {
        return {value: {value: val, case: 'stringValue'}};
    } else if (typ === 'number') {
        // Note: otlp-transformer uses `intValue` if Number.isInteger(val).
        // However protobufjs and bufbuild differ in how they represent the
        // protobuf `int64` type in their JS bindings, so `intValue` isn't
        // necessarily correct here. Using `intValue` results in getting a
        // BigInt on the other side. That is surprising.
        return {value: {value: val, case: 'doubleValue'}};
    } else if (typ === 'boolean') {
        return {value: {value: val, case: 'boolValue'}};
    } else if (typ === 'bigint') {
        return {value: {value: val, case: 'intValue'}};
    } else if (val instanceof Uint8Array) {
        return {value: {value: val, case: 'bytesValue'}};
    } else if (Array.isArray(val)) {
        return {
            value: {
                case: 'arrayValue',
                value: {values: val.map(anyValueFromVal)},
            },
        };
    } else if (typ === 'object' && val != null) {
        const values = [];
        const valKeys = Object.keys(val);
        for (let i = 0; i < valKeys.length; i++) {
            const k = valKeys[i];
            values.push({key: k, value: anyValueFromVal(val[k])});
        }
        return {
            value: {
                case: 'kvlistValue',
                value: {values},
            },
        };
    } else {
        return {}; // current repr for null, undefined, and unknown types
    }
}

/**
 * @typedef {function(OnMessageData): void} OnMessageCallback
 * @callback OnMessageCallback
 * @param {OnMessageData} data
 */

/**
 * @typedef {Object} OnMessageData
 * @property {AgentRemoteConfig} [remoteConfig]
 */

/**
 * @typedef {Object} OpAMPClientOptions
 * @property {Object} [log] - A logger instance with .trace(), .debug(), etc.
 *      methods a la Pino/Bunyan/Luggite.
 * @property {String} endpoint - The URL of the OpAMP server, including the
 *      path (typically '/v1/opamp').
 * @property {Object} [headers] - Additional HTTP headers to include in requests.
 * @property {Uint8Array[16] | string} [instanceUid] - Globally unique identifier
 *      for the OpAMP agent. Should be a UUID v7. Could also be set to an OTel
 *      'service.instance.id' resource attribute. If not provided, a UUID v7
 *      will generated.
 * @property {BigInt} [capabilities] - Bitmask of capabilities to enable.
 *      Currently only the following are supported:
 *          - ReportsStatus (always on)
 *          - ReportsHeartbeat (always on, because using HTTP transport)
 *          - AcceptsRemoteConfig
 *          - ReportsRemoteConfig
 *      It is an error to specify other capabilities.
 *      https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#agenttoservercapabilities
 * @property {Number} [heartbeatIntervalSeconds] The approximate time between
 *      heartbeat messages sent by the client. Default 30.
 * @property {OnMessageCallback} [onMessage] A callback of the form
 *
 * TODO: enableCompression or similar option
 * TODO: add {ConnectionOptions} [connect] with a subset of https://undici.nodejs.org/#/docs/api/Client?id=parameter-connectoptions e.g. as used in play.mjs for `ca: [cacert]` to conn to opamp-go example server. Or could expose the full ConnectOptions, but that's heavy.
 */

// See opamp-go/client/client.go for some inspiration for this interface.
class OpAMPClient {
    /**
     * @param {OpAMPClientOptions} opts
     */
    constructor(opts) {
        this._log = opts.log ?? new NoopLogger();
        this._endpoint = new URL(opts.endpoint);
        this._headers = {...DEFAULT_HEADERS, ...opts.headers};
        this._sequenceNum = 0n; // First sent sequenceNum is `1`.
        this._instanceUid = normalizeInstanceUid(
            opts.instanceUid ?? genUuidv7()
        );
        this._capabilities = normalizeCapabilities(opts.capabilities);
        this._heartbeatIntervalMs =
            normalizeHeartbeatIntervalSeconds(opts.heartbeatIntervalSeconds) *
            1000;
        this._onMessage = opts.onMessage;

        this._started = false;
        this._shutdown = false;
        this._serverCapabilities = null;
        /** @type {AgentDescription} */
        this._agentDescription = null;
        this._remoteConfigStatus = create(RemoteConfigStatusSchema, {
            lastRemoteConfigHash: new Uint8Array(0),
            status: RemoteConfigStatuses.RemoteConfigStatuses_UNSET,
        });

        /** @type {AgentToServer} */
        this._nextSendTime = null;
        this._nextSendTimeout = null;
        this._queue = [];

        this._httpClient = new undici.Client(this._endpoint.origin, {
            // TODO: revisit various timeouts
            bodyTimeout: 10000,
            // `connect` is an undocumented access to undici ConnectionOptions,
            // useful for TLS options.
            // https://undici.nodejs.org/#/docs/api/Client?id=parameter-connectoptions
            // TODO: limit this to a subset b/c the available options are huge
            connect: opts.connect,
            // TODO: allowH2: true ?
        });
    }

    /**
     * setAgentDescription MUST be called before `.start()`.
     * Can be called again later after start.
     * See https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#agentdescription-message
     *
     * Dev Note: `desc` is *not* the raw `AgentDescription` type from bufbuild.
     * This is for convenience in providing attributes as JS object, rather than
     * the verbose proto-library-specific representation.
     *
     * @param {{identifyingAttributes?: object, nonIdentifyingAttributes?: object}} desc
     */
    setAgentDescription(desc) {
        /** @type {Partial<AgentDescription>} */
        const agentDescription = {
            identifyingAttributes: keyValuesFromObj(desc.identifyingAttributes),
            nonIdentifyingAttributes: keyValuesFromObj(
                desc.nonIdentifyingAttributes
            ),
        };

        // TODO: test re-setting this and determining if changed
        const agentDescriptionSer = toBinary(
            AgentDescriptionSchema,
            create(AgentDescriptionSchema, agentDescription)
        );
        let isChanged = false;
        if (!this._agentDescription) {
            isChanged = true;
        } else {
            isChanged = isEqualUint8Array(
                this._agentDescriptionSer,
                agentDescriptionSer
            );
        }

        if (isChanged) {
            this._agentDescription = agentDescription;
            this._agentDescriptionSer = agentDescriptionSer;
            this._queue.push('AgentDescription');
            this._scheduleSendSoon();
        }
    }

    start() {
        if (this._started) {
            throw new Error('OpAMPClient already started');
        }
        if (!this._agentDescription) {
            // TODO: allow agentDescription arg in ctor?
            throw new Error(
                'OpAMPClient#setAgentDescription() must be called before start()'
            );
        }
        this._started = true;

        this._queue.push('ReportFullState');
        this._scheduleSendSoon();
    }

    /**
     * Do an orderly shutdown.
     * A shutdown OpAMPClient cannot be restarted.
     */
    async shutdown() {
        if (this._shutdown) {
            throw new Error('cannot shutdown OpAMPClient multiple times');
        }
        this._shutdown = true;
        if (this._started) {
            this._httpClient.close();
            this._httpClient = null;
        }
    }

    /**
     * Dev Note: This client manages the `instanceUid`, so I'm not sure if this
     * API method is useful. The instanceUid *can* be changed by the OpAMP
     * server.
     */
    getInstanceUid() {
        return this._instanceUid;
    }

    // `_hasCap*` are conveniences to avoid the verbose bitmasking.
    _hasCapReportsRemoteConfig() {
        return (
            this._capabilities &
            BigInt(AgentCapabilities.AgentCapabilities_ReportsRemoteConfig)
        );
    }
    _hasCapAcceptsRemoteConfig() {
        return (
            this._capabilities &
            BigInt(AgentCapabilities.AgentCapabilities_AcceptsRemoteConfig)
        );
    }

    /**
     * # How scheduling sending of messages from the OpAMP client works
     *
     * - Sending is done in `_sendMsg()` -- including retry/backoff handling.
     *   We only ever want one active at a time.
     * - If there is info to send (e.g. new AgentDescription) it is on
     *   `this._queue`.
     * - When `_sendMsg()` finishes, it checks the queue. If there is something
     *   to send, it will `_scheduleSendSoon()` to flush the queue. Otherwise
     *   it will `_scheduleSendHeartbeat()` to maintain period heartbeats.
     * - New info to send can come from any of:
     *      - A ServerToAgent.flags request to "ReportFullState". This is
     *        handled as part of `_sendMsg` calling `_processServerToAgent()`.
     *      - Client API methods being called, e.g. `.setRemoteConfigStatus()`.
     *        These will append to the `_queue` and call `_scheduleSendSoon()`.
     */

    _scheduleSendSoon() {
        assert.ok(this._queue.length > 0);

        // "Soon" is short enough to be timely enough for OpAMP, but long enough
        // for debouncing (https://developer.mozilla.org/en-US/docs/Glossary/Debounce).
        const SOON_MS = 30;

        if (this._started && !this._sending && !this._shutdown) {
            const delayMs = jitter(SOON_MS);
            this._scheduleSend(delayMs);
        }
    }

    _scheduleSendHeartbeat() {
        if (this._started && !this._sending && !this._shutdown) {
            const delayMs = jitter(this._heartbeatIntervalMs);
            this._scheduleSend(delayMs);
        }
    }

    _scheduleSend(delayMs) {
        assert.ok(typeof delayMs === 'number' && delayMs >= 0);

        const sendTime = Date.now() + delayMs;
        if (!this._nextSendTime || sendTime < this._nextSendTime) {
            this._log.trace({delayMs}, 'schedule next opamp send');
            if (this._nextSendTimeout) {
                clearTimeout(this._nextSendTimeout);
            }
            this._nextSendTime = sendTime;
            this._nextSendTimeout = setTimeout(() => {
                this._nextSendTime = null;
                this._sendMsg();
            }, delayMs);
            this._nextSendTimeout.unref();
        }
    }

    /**
     * Set a status update to the server, then schedule the next send.
     * Data to send is on `this._queue`, else this is a simple heartbeat.
     *
     * This sets `this._sending = true` for its duration. This function cannot
     * throw, otherwise the client will be wedged.
     */
    async _sendMsg() {
        this._sending = true;
        this._log.trace({queue: this._queue}, '_sendMsg start');

        /** @type {AgentToServer} */
        let msg = {
            instanceUid: this._instanceUid,
            capabilities: this._capabilities,
            sequenceNum: ++this._sequenceNum,
        };
        while (this._queue.length > 0) {
            const entry = this._queue.shift();
            switch (entry) {
                case 'ReportFullState':
                    msg.instanceUid = this._instanceUid;
                    msg.capabilities = this._capabilities;
                    msg.agentDescription = this._agentDescription;
                    if (this._hasCapReportsRemoteConfig()) {
                        msg.remoteConfigStatus = this._remoteConfigStatus;
                    }
                    break;
                case 'AgentDescription':
                    msg.agentDescription = this._agentDescription;
                    break;
                case 'RemoteConfigStatus':
                    msg.remoteConfigStatus = this._remoteConfigStatus;
                    break;
                default:
                    throw new Error(`unknown queue entry: ${entry}`);
            }
        }

        const a2s = create(AgentToServerSchema, msg);
        this._log.trace({a2s: logserA2S(a2s)}, 'sending AgentToServer');
        const reqBody = toBinary(AgentToServerSchema, a2s);

        // AFAICT from https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#retrying-messages
        // the only message that "requires a response" is the initial status.
        // So we only need retry/backoff logic for that first message. All
        // others can rely on heartbeating and the server requesting
        // ReportFullState if it needs.
        // XXX modulo HTTP 503 and 429 with Retry-After
        // XXX and an errorResponse with RetryInfo

        // XXX HERE error handling
        // - try https://undici.nodejs.org/#/docs/api/RetryAgent.md
        // - `retry` fn holds the logic, can immediate callback(err) for cases
        //   where we don't want retry
        // - Q: does it already do exp. backoff? Docs don't specify.
        // - Can errorResponse body with RetryInfo be in here? Probably not
        //   because the request is done then, so manually need to handle
        //   that by ... a re-call into _sendMsg???

        let res;
        try {
            // https://undici.nodejs.org/#/docs/api/Dispatcher.md?id=dispatcherrequestoptions-callback
            res = await this._httpClient.request({
                method: 'POST',
                path: this._endpoint.pathname,
                headers: {
                    ...this._headers,
                    'Content-Type': 'application/x-protobuf',
                },
                body: reqBody,
            });
        } catch (reqErr) {
            console.log('XXX reqErr: ', reqErr);
        }
        console.log('XXX _sendMsg:', res.statusCode, res.headers);
        // TODO cope with errors, check content-type is x-protobuf
        const resBody = await res.body.bytes();
        const s2a = fromBinary(ServerToAgentSchema, resBody);
        // console.log('XXX _sendMsg: s2a: ', s2a);
        this._log.trace({s2a: logserS2A(s2a)}, 'received ServerToAgent');

        // XXX handle s2a.errorResponse
        //  - do we handle that even if instanceUid is wrong?

        this._processServerToAgent(s2a);

        this._sending = false;

        // Schedule next send.
        if (this._queue.length > 0) {
            this._scheduleSendSoon();
        } else {
            this._scheduleSendHeartbeat();
        }
    }

    /**
     * @param {ServerToAgent} s2a
     */
    _processServerToAgent(s2a) {
        // A possible `s2a.errorResponse` has been handled in _sendMsg.

        if (!isEqualUint8Array(s2a.instanceUid, this._instanceUid)) {
            this._log.trace(
                {s2aVal: s2a.instanceUid, clientVal: this._instanceUid},
                'ignore ServerToAgent with non-matching instanceUid'
            );
            return;
        }

        // Log a note if the server doesn't support a capability that the client
        // supports.
        if (s2a.capabilities !== this._serverCapabilities) {
            this._serverCapabilities = s2a.capabilities;
            if (
                this._hasCapAcceptsRemoteConfig() &&
                !(
                    this._serverCapabilities &
                    BigInt(
                        ServerCapabilities.ServerCapabilities_OffersRemoteConfig
                    )
                )
            ) {
                this._log.debug(
                    'this OpAMP client was configured with "AcceptsRemoteConfig", but the OpAMP server capabilities do not include "OffersRemoteConfig"'
                );
            }
        }

        if (
            s2a.flags &
            BigInt(ServerToAgentFlags.ServerToAgentFlags_ReportFullState)
        ) {
            this._queue.push('ReportFullState');
            // The end of _sendMsg() will schedule a send soon for this.
        }

        // Dev Note: `onMessage` and `onMessageData` are based on the opamp-go
        // client `MessageData` design that groups all relevant data for a
        // single callback to the user.
        const onMessageData = {};
        if (s2a.remoteConfig && this._hasCapAcceptsRemoteConfig()) {
            onMessageData.remoteConfig = s2a.remoteConfig;
        }

        // Dev Note: A possible new instanceUid is *not* added to onMessageData
        // because, unlike opamp-go, this client maintains the `instanceUid`
        // rather than having the calling code responsible for that.
        if (s2a.agentIdentification?.newInstanceUid) {
            // TODO: test this
            const oldInstanceUidStr = uuidStringify(this._instanceUid);
            this._instanceUid = s2a.agentIdentification.newInstanceUid;
            let newInstanceUidStr = uuidStringify(this._instanceUid);
            this._log.info(
                {oldInstanceUidStr, newInstanceUidStr},
                'AgentIdentification.new_instance_id'
            );
        }

        // Call onMessage callback, if any.
        if (this._onMessage && Object.keys(onMessageData).length > 0) {
            // XXX doc for user: This `onMessage` callback could be called
            //      multiple times with the same data, e.g. with remoteCOnfig.
            //      They should be processed serially with duplicate info
            //      being ignored (e.g. use lastConfigHash to avoid dupe work)
            this._onMessage(onMessageData);
        }
    }
}

/**
 * @param {OpAMPClientOptions} opts
 */
function createOpAMPClient(opts) {
    return new OpAMPClient(opts);
}

module.exports = {
    USER_AGENT,
    createOpAMPClient,

    // Re-exports of some protobuf classes/enums.
    AgentCapabilities,
};
