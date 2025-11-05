/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const assert = require('assert');
const {channel} = require('diagnostics_channel');

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
    ServerCapabilities,
    ServerToAgentFlags,
    AgentDescriptionSchema,
    ServerErrorResponseType,
} = require('./generated/opamp_pb');
const {logserA2S, logserS2A, NoopLogger} = require('./logging');
const {
    jitter,
    isEqualUint8Array,
    keyValuesFromObj,
    msFromRetryAfterHeader,
    msFromRetryAfterNs,
} = require('./utils');

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

// These 10s timeout default values were unscientifically chosen.
const DEFAULT_HEADERS_TIMEOUT = 10 * 1000;
const DEFAULT_BODY_TIMEOUT = 10 * 1000;

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
// A 100ms heartbeat interval is crazy low, but might be useful for testing.
const MIN_HEARTBEAT_INTERVAL_SECONDS = 0.1;
const MAX_HEARTBEAT_INTERVAL_SECONDS = 86400; // 1d

// Diagnostics channel names.
const DIAG_CH_SEND_SUCCESS = 'opamp-client.send.success';
const DIAG_CH_SEND_FAIL = 'opamp-client.send.fail';
const DIAG_CH_SEND_SCHEDULE = 'opamp-client.send.schedule';

/**
 * @param {string | Uint8Array} input
 * @returns {Uint8Array}
 */
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
    } else if (typeof input !== 'number' || isNaN(input)) {
        throw new Error(`invalid "heartbeatIntervalSeconds" value: ${input}`);
    } else if (input < MIN_HEARTBEAT_INTERVAL_SECONDS) {
        return MIN_HEARTBEAT_INTERVAL_SECONDS;
    } else if (input > MAX_HEARTBEAT_INTERVAL_SECONDS) {
        return MAX_HEARTBEAT_INTERVAL_SECONDS;
    } else {
        return input;
    }
}

/**
 * @callback OnMessageCallback
 * @param {OnMessageData} data
 */

/**
 * @typedef {Object} OnMessageData
 * @property {AgentRemoteConfig} [remoteConfig]
 */

/**
 * @typedef {Pick<import('tls').ConnectionOptions, 'ca' | 'cert' | 'key'>} ConnectOptions
 */

/**
 * @typedef {Object} OpAMPClientOptions
 * @property {Object} [log] - A logger instance with .trace(), .debug(), etc.
 *      methods a la Pino/Bunyan/Luggite.
 * @property {String} endpoint - The URL of the OpAMP server, including the
 *      path (typically '/v1/opamp').
 * @property {Object} [headers] - Additional HTTP headers to include in requests.
 * @property {Uint8Array | string} [instanceUid] - Globally unique identifier
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
 * @property {OnMessageCallback} [onMessage] A callback of the form
 *      `({remoteConfig}) => {}` that is called when a server response provides
 *      data for the client. Currently the only type of data supported is
 *      remote config. Receiving remote config requires setting the
 *      `AcceptsRemoteConfig` capability in `capabilities`.
 * @property {Number} [heartbeatIntervalSeconds] The approximate time between
 *      heartbeat messages sent by the client. Default 30.
 *      Clamped to [100ms, 1d].
 * @property {number} [headersTimeout] The timeout (in milliseconds) to wait
 *      for the response headers on a request to the OpAMP server. Default 10s.
 * @property {number} [bodyTimeout] The timeout (in milliseconds) to wait for
 *      the response body on a request to the OpAMP server. Default 10s.
 * @property {ConnectOptions} [connect] A small subset of Undici client connect
 *      options (https://undici.nodejs.org/#/docs/api/Client?id=parameter-connectoptions).
 *      Primarily this is intended to support mTLS options:
 *          - [ca] Override the trusted CA certificates.
 *            See https://nodejs.org/api/all.html#all_tls_tlscreatesecurecontextoptions
 *          - [cert] TLS certificate chains in PEM format.
 *            See https://nodejs.org/api/all.html#all_tls_tlscreatesecurecontextoptions
 *          - [key] Private keys in PEM format.
 *            See https://nodejs.org/api/all.html#all_tls_tlscreatesecurecontextoptions
 * @property {boolean} [diagEnabled] Diagnostics enabled, typically used for
 *      testing. When enabled, events will be published to the following
 *      diagnostics channels:
 *      - `opamp-client.send.success`: {a2s, s2a}
 *      - `opamp-client.send.fail`: {a2s, err, retryAfterMs}
 *      - `opamp-client.send.schedule`: {delayMs, errCount}
 *
 * TODO: enableCompression or similar option
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
        this._instanceUidStr = uuidStringify(this._instanceUid);
        this._capabilities = normalizeCapabilities(opts.capabilities);
        try {
            this._heartbeatIntervalMs =
                normalizeHeartbeatIntervalSeconds(
                    opts.heartbeatIntervalSeconds
                ) * 1000;
        } catch (err) {
            this._log.warn(
                {err, heartbeatIntervalSeconds: opts.heartbeatIntervalSeconds},
                'invalid heartbeatIntervalSeconds'
            );
            this._heartbeatIntervalMs =
                DEFAULT_HEARTBEAT_INTERVAL_SECONDS * 1000;
        }
        this._onMessage = opts.onMessage;

        if (opts.diagEnabled) {
            this._diagChs = {
                [DIAG_CH_SEND_SUCCESS]: channel(DIAG_CH_SEND_SUCCESS),
                [DIAG_CH_SEND_FAIL]: channel(DIAG_CH_SEND_FAIL),
                [DIAG_CH_SEND_SCHEDULE]: channel(DIAG_CH_SEND_SCHEDULE),
            };
        } else {
            this._diagChs = null;
        }
        this._diagEnabled = Boolean(opts.diagEnabled);

        this._started = false;
        this._shutdown = false;
        this._serverCapabilities = null;
        /** @type {AgentDescription} */
        this._agentDescription = null;
        this._remoteConfigStatus = create(RemoteConfigStatusSchema, {});

        this._numSendFailures = 0;
        this._nextSendTime = null;
        this._nextSendTimeout = null;
        this._queue = [];

        this._httpClient = new undici.Client(this._endpoint.origin, {
            headersTimeout: opts.headersTimeout ?? DEFAULT_HEADERS_TIMEOUT,
            bodyTimeout: opts.bodyTimeout ?? DEFAULT_BODY_TIMEOUT,
            // A limited subset (because the full set is huge) of undici ConnectionOptions
            // https://undici.nodejs.org/#/docs/api/Client?id=parameter-connectoptions
            // TODO: actually limit to the documented subset?
            connect: opts.connect,
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
        const agentDescription = create(AgentDescriptionSchema, {
            identifyingAttributes: keyValuesFromObj(desc.identifyingAttributes),
            nonIdentifyingAttributes: keyValuesFromObj(
                desc.nonIdentifyingAttributes
            ),
        });

        const agentDescriptionSer = toBinary(
            AgentDescriptionSchema,
            agentDescription
        );
        let isChanged = false;
        if (!this._agentDescription) {
            isChanged = true;
        } else {
            isChanged = !isEqualUint8Array(
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

    /**
     * Dev Note: This client manages the `instanceUid`, so I'm not sure if this
     * API method is useful. The instanceUid *can* be changed by the OpAMP
     * server.
     */
    getInstanceUid() {
        return this._instanceUid;
    }

    start() {
        if (this._started) {
            throw new Error('OpAMPClient already started');
        }
        if (!this._agentDescription) {
            throw new Error(
                'OpAMPClient#setAgentDescription() must be called before start()'
            );
        }
        this._started = true;

        this._queue.push('ReportFullState');
        // Use `setImmediate` so a caller of `client.start()` can do synchronous
        // setup before scheduling happens. Specifically this is helpful for
        // calling .start() and *then* subscribing to diag events in tests.
        setImmediate(() => {
            this._scheduleSendSoon();
        });
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
        if (this._nextSendTimeout) {
            clearTimeout(this._nextSendTimeout);
            this._nextSendTimeout = null;
        }
        this._nextSendTime = null;

        // https://undici.nodejs.org/#/docs/api/Dispatcher.md?id=dispatcherclosecallback-promise
        return this._httpClient.close();
    }

    /**
     * setRemoteConfigStatus sets the current RemoteConfigStatus and, if
     * changed, schedules sending a message to the server.
     *
     * May be called anytime after start(), including from the `onMessage`
     * handler.
     *
     * @param {RemoteConfigStatus} remoteConfigStatus - The
     *      `lastRemoteConfigHash` property must be set, other properties are
     *      optional.
     */
    setRemoteConfigStatus(remoteConfigStatus) {
        if (!this._hasCapReportsRemoteConfig()) {
            throw new Error(
                'do not call `setRemoteConfigStatus()` when `ReportsRemoteConfig` capability is not set'
            );
        }
        if (!remoteConfigStatus.lastRemoteConfigHash) {
            throw new Error('`lastRemoteConfigHash` is not set');
        }

        // Save the new status and determine if changed.
        let isChanged = false;
        if (
            'status' in remoteConfigStatus &&
            remoteConfigStatus.status !== this._remoteConfigStatus.status
        ) {
            isChanged = true;
            this._remoteConfigStatus.status = remoteConfigStatus.status;
        }
        if (
            !isEqualUint8Array(
                remoteConfigStatus.lastRemoteConfigHash,
                this._remoteConfigStatus.lastRemoteConfigHash
            )
        ) {
            isChanged = true;
            this._remoteConfigStatus.lastRemoteConfigHash =
                remoteConfigStatus.lastRemoteConfigHash;
        }
        if (
            'errorMessage' in remoteConfigStatus &&
            remoteConfigStatus.errorMessage !==
                this._remoteConfigStatus.errorMessage
        ) {
            isChanged = true;
            this._remoteConfigStatus.errorMessage =
                remoteConfigStatus.errorMessage;
        }

        if (isChanged) {
            this._queue.push('RemoteConfigStatus');
            this._scheduleSendSoon();
        }
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
     * - New info to send can come from any of:
     *      - A ServerToAgent.flags request to "ReportFullState". This is
     *        handled as part of `_sendMsg` calling `_processServerToAgent()`.
     *      - Client API methods being called, e.g. `.setRemoteConfigStatus()`.
     *        These will append to the `_queue` and call `_scheduleSendSoon()`.
     * - If there is info to send (e.g. new AgentDescription) it is on
     *   `this._queue`.
     * - When `_sendMsg()` finishes successfully, it checks the queue. If there
     *   is something to send, it will `_scheduleSendSoon()` to flush the queue.
     *   Otherwise it will `_scheduleSendHeartbeat()` to maintain periodic
     *   heartbeats.
     * - If `_sendMsg()` fails, there are a number of failure modes (see the
     *   specifics in `_sendMsg`). Generally it will log some failure details,
     *   re-enqueue the msg data to be sent and either retry sending after some
     *   exponential backoff, or after a given Retry-After header time.
     */

    _scheduleSendSoon() {
        assert.ok(this._queue.length > 0);
        if (this._numSendFailures > 0) {
            this._log.trace(
                {
                    numSendFailures: this._numSendFailures,
                },
                'ignore _scheduleSendSoon because have send failures'
            );
            return;
        }

        // "Soon" is short enough to be timely enough for OpAMP, but long enough
        // for debouncing (https://developer.mozilla.org/en-US/docs/Glossary/Debounce).
        const SOON_MS = 30;

        const delayMs = jitter(SOON_MS);
        this._scheduleSend(delayMs, false);
    }

    _scheduleSendHeartbeat() {
        const delayMs = jitter(this._heartbeatIntervalMs);
        this._scheduleSend(delayMs, false);
    }

    /**
     * @param {number} retryAfterMs
     */
    _scheduleSendRetryAfter(retryAfterMs) {
        const delayMs = jitter(retryAfterMs);
        this._scheduleSend(delayMs, true);
    }

    _scheduleSendAfterErr() {
        assert.ok(this._numSendFailures > 0);

        // Exponential backoff from 30s to ~5min.
        // - The "30s" comes from this at https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#plain-http-transport-2:
        //   > The minimum recommended retry interval is 30 seconds.
        // - The "~5min" was selected to be >30s, but not too long. There is
        //   no retry max stated in the OpAMP spec.
        // - This exponential formula:
        //      Math.min(300,  (Math.min(n++, 10) ** 3) + 29  )
        //   results in retry intervals of:
        //      [30s, 37s, 56s, 93s, 154s, 245s, 300s]
        const delayS = Math.min(
            300,
            Math.min(this._numSendFailures, 10) ** 3 + 29
        );
        const delayMs = jitter(delayS * 1000);
        this._log.trace(
            {delayS, numSendFailures: this._numSendFailures},
            '_scheduleSendAfterErr'
        );
        this._scheduleSend(delayMs, true);
    }

    /**
     * This should only be called by the other `_scheduleSend*` methods above.
     *
     * @param {number} delayMs
     * @param {boolean} overrideExisting - Whether to override an existing
     *      scheduled send, even if the existing one is *sooner* that the given
     *      delayMs.
     */
    _scheduleSend(delayMs, overrideExisting) {
        assert.ok(typeof delayMs === 'number' && delayMs >= 0);

        if (!(this._started && !this._sending && !this._shutdown)) {
            // Invalid to schedule a send in the current state.
            this._log.trace(
                {
                    started: this._started,
                    sending: this._sending,
                    shutdown: this._shutdown,
                },
                'ignore _scheduleSend'
            );
            return;
        }

        // Schedule the send in `delayMs`, unless one is already scheduled for
        // sooner or `overrideExisting`.
        const sendTime = Date.now() + delayMs;
        if (
            overrideExisting ||
            !this._nextSendTime ||
            sendTime < this._nextSendTime
        ) {
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
            if (this._diagChs && !this._shutdown) {
                this._diagChs[DIAG_CH_SEND_SCHEDULE].publish({
                    instanceUidStr: this._instanceUidStr,
                    name: DIAG_CH_SEND_SCHEDULE,
                    time: Date.now(),
                    delayMs,
                    errCount: this._numSendFailures,
                });
            }
        }
    }

    /**
     * Send a status update to the server, then schedule the next send.
     * Data to send is either on `this._queue`, or this is a simple heartbeat.
     *
     * Dev Note: This sets `this._sending = true` for its duration. This
     * function cannot throw, otherwise the client will be wedged.
     *
     * Error handling behaviour is loosely derived from the OpAMP spec,
     * including sections "Establishing Connection", "Retrying Messages" and
     * "Throttling". It isn't always clear the exact intent:
     *
     * - if `client.request()` rejects (no conn, headersTimeout): log.error, re-enqueue, schedule with backoff(30s .. 5min)
     * - if HTTP 429 with valid `Retry-After` header: log.debug, re-enqueue, schedule for given time (min 30s)
     * - if HTTP 503 with valid `Retry-After` header: log.error, re-enqueue, schedule for given time (min 30s)
     * - if HTTP != 200 || content-type != protobuf: log.error, re-enqueue, schedule with backoff(30s .. 5min)
     * - if `await res.body.bytes()` rejection (bodyTimeout): log.error, re-enqueue, schedule with backoff(30s .. 5min)
     * - if s2a.errorResponse:
     *     - if .type == "Unavailable" && .Details.retryAfterNanoseconds > 0: log.debug, re-enqueue, schedule for given time (min 30s)
     *     - if .type == "BadRequest": log.error, do *not* re-enqueue, schedule for given time (min 30s)
     *     - else: log.error, re-enqueue, schedule with backoff(30s .. 5min)
     * - else success: process the `s2a` message
     */
    async _sendMsg() {
        this._sending = true;
        this._log.trace({queue: this._queue}, '_sendMsg start');

        let a2s = create(AgentToServerSchema, {
            instanceUid: this._instanceUid,
            capabilities: this._capabilities,
            sequenceNum: ++this._sequenceNum,
        });
        const queue = this._queue;
        this._queue = [];
        for (let entry of queue) {
            switch (entry) {
                case 'ReportFullState':
                    a2s.instanceUid = this._instanceUid;
                    a2s.capabilities = this._capabilities;
                    a2s.agentDescription = structuredClone(
                        this._agentDescription
                    );
                    if (this._hasCapReportsRemoteConfig()) {
                        a2s.remoteConfigStatus = structuredClone(
                            this._remoteConfigStatus
                        );
                    }
                    break;
                case 'AgentDescription':
                    a2s.agentDescription = structuredClone(
                        this._agentDescription
                    );
                    break;
                case 'RemoteConfigStatus':
                    a2s.remoteConfigStatus = structuredClone(
                        this._remoteConfigStatus
                    );
                    break;
                default:
                    throw new Error(`unknown queue entry: ${entry}`);
            }
        }

        this._log.trace({a2s: logserA2S(a2s)}, 'sending AgentToServer');
        const reqBody = toBinary(AgentToServerSchema, a2s);

        // `_sendMsg()` ends with a single `finishSuccess` or `finishFail`.
        let isFinished = false;
        const finishSuccess = () => {
            if (isFinished) {
                throw new Error('_sendMsg finish called more than once');
            }
            isFinished = true;
            this._numSendFailures = 0;
            this._sending = false;
            if (this._diagChs && !this._shutdown) {
                this._diagChs[DIAG_CH_SEND_SUCCESS].publish({
                    instanceUidStr: this._instanceUidStr,
                    name: DIAG_CH_SEND_SUCCESS,
                    time: Date.now(),
                    a2s,
                    s2a,
                });
            }
            if (this._queue.length > 0) {
                this._scheduleSendSoon();
            } else {
                this._scheduleSendHeartbeat();
            }
        };
        /**
         * @param {Error | string} err
         * @param {boolean} shouldReenqueue
         * @param {number | null} retryAfterMs
         */
        const finishFail = (err, shouldReenqueue, retryAfterMs) => {
            if (isFinished) {
                throw new Error('_sendMsg finish called more than once');
            }
            isFinished = true;
            this._numSendFailures += 1;
            this._sending = false;
            if (shouldReenqueue) {
                this._queue = queue.concat(this._queue); // Re-enqueue info to send.
            }
            if (this._diagChs && !this._shutdown) {
                this._diagChs[DIAG_CH_SEND_FAIL].publish({
                    instanceUidStr: this._instanceUidStr,
                    name: DIAG_CH_SEND_FAIL,
                    time: Date.now(),
                    a2s,
                    err,
                    retryAfterMs,
                });
            }
            if (retryAfterMs) {
                this._scheduleSendRetryAfter(retryAfterMs);
            } else {
                this._scheduleSendAfterErr();
            }
        };

        // Make the request.
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
            this._log.error(
                {endpoint: this._endpoint.href, err: reqErr},
                'OpAMP client request error'
            );
            finishFail(reqErr, true, null);
            return;
        }
        if (res.statusCode == 429) {
            let retryAfter = res.headers['retry-after'] || '';
            if (Array.isArray(retryAfter)) {
                retryAfter = retryAfter[retryAfter.length - 1];
            }
            const retryAfterMs = msFromRetryAfterHeader(retryAfter);
            const errMsg = 'OpAMP server HTTP 429';
            this._log.debug(
                {endpoint: this._endpoint.href, retryAfter, retryAfterMs},
                errMsg
            );
            finishFail(errMsg, true, retryAfterMs);
            return;
        }
        if (res.statusCode == 503) {
            let retryAfter = res.headers['retry-after'];
            if (Array.isArray(retryAfter)) {
                retryAfter = retryAfter[retryAfter.length - 1];
            }
            const retryAfterMs = retryAfter
                ? msFromRetryAfterHeader(retryAfter)
                : null;
            const errMsg = 'OpAMP server HTTP 503';
            this._log.error(
                {endpoint: this._endpoint.href, retryAfter, retryAfterMs},
                errMsg
            );
            finishFail(errMsg, true, retryAfterMs);
            return;
        }
        if (res.statusCode !== 200) {
            const errMsg = `unexpected OpAMP response: statusCode=${res.statusCode}`;
            this._log.error({endpoint: this._endpoint.href}, errMsg);
            finishFail(errMsg, true, null);
            return;
        }
        if (res.headers['content-type'] !== 'application/x-protobuf') {
            const errMsg = `unexpected OpAMP response Content-Type: '${res.headers['content-type']}'`;
            this._log.error({endpoint: this._endpoint.href}, errMsg);
            finishFail(errMsg, true, null);
            return;
        }

        // Read and parse the response body.
        let resBody;
        try {
            resBody = await res.body.bytes();
        } catch (bodyErr) {
            // Typically this is a BodyTimeoutError.
            this._log.error(
                {endpoint: this._endpoint.href, err: bodyErr},
                'OpAMP client error reading response body'
            );
            // Cancel the body (https://undici.nodejs.org/#/?id=garbage-collection).
            res.body.destroy();
            finishFail(bodyErr, true, null);
            return;
        }
        /** @type {ServerToAgent} */
        const s2a = fromBinary(ServerToAgentSchema, resBody);
        this._log.trace({s2a: logserS2A(s2a)}, 'received ServerToAgent');

        if (s2a.errorResponse) {
            let errMsg,
                shouldReenqueue = true,
                retryAfterMs = null;
            switch (s2a.errorResponse.type) {
                case ServerErrorResponseType.ServerErrorResponseType_BadRequest:
                    // https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#bad-request
                    errMsg = `ServerErrorResponse BadRequest: ${s2a.errorResponse.errorMessage}`;
                    shouldReenqueue = false;
                    break;
                case ServerErrorResponseType.ServerErrorResponseType_Unavailable:
                    errMsg = `ServerErrorResponse Unavailable: ${s2a.errorResponse.errorMessage}`;
                    if (s2a.errorResponse.Details.case === 'retryInfo') {
                        retryAfterMs = msFromRetryAfterNs(
                            s2a.errorResponse.Details.value
                                .retryAfterNanoseconds
                        );
                    }
                    break;
                case ServerErrorResponseType.ServerErrorResponseType_Unknown:
                    errMsg = `ServerErrorResponse Unknown: ${s2a.errorResponse.errorMessage}`;
                    break;
                default:
                    errMsg = `ServerErrorResponse unexpected type: ${s2a.errorResponse.type}`;
                    break;
            }
            finishFail(errMsg, shouldReenqueue, retryAfterMs);
            return;
        }

        this._processServerToAgent(s2a);
        finishSuccess();
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
            const oldInstanceUidStr = this._instanceUidStr;
            this._instanceUid = s2a.agentIdentification.newInstanceUid;
            this._instanceUidStr = uuidStringify(this._instanceUid);
            this._log.info(
                {oldInstanceUidStr, newInstanceUidStr: this._instanceUidStr},
                'AgentIdentification.new_instance_id'
            );
        }

        // Call onMessage callback, if any.
        if (this._onMessage && Object.keys(onMessageData).length > 0) {
            // Use queueMicrotask to allow `_sendMsg` to *finish* before the
            // user callback is called.
            queueMicrotask(() => {
                try {
                    this._onMessage(onMessageData);
                } catch (err) {
                    this._log.warn(
                        err,
                        'ignoring exception from `onMessage` callback'
                    );
                }
            });
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
    DIAG_CH_SEND_SUCCESS,
    DIAG_CH_SEND_FAIL,
    DIAG_CH_SEND_SCHEDULE,
    USER_AGENT,
    createOpAMPClient,
};
