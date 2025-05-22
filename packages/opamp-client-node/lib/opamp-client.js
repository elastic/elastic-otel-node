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
    RemoteConfigStatuses,
    ServerCapabilities,
    ServerToAgentFlags,
    AgentDescriptionSchema,
} = require('./generated/opamp_pb');
const {NoopLogger} = require('./logging');
const {
    jitter,
    logserA2S,
    logserS2A,
    isEqualUint8Array,
    keyValuesFromObj,
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

// Diagnostics channel names.
const DIAG_CH_SEND_SUCCESS = 'opamp-client.send.success';
const DIAG_CH_SEND_FAIL = 'opamp-client.send.fail';
const DIAG_CH_SEND_SCHEDULE = 'opamp-client.send.schedule';

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
 * @property {boolean} [diagEnabled] Diagnostics enabled, typically used for
 *      testing. When enabled, events will be published to the following
 *      diagnostics channels:
 *      - `opamp-client.send.success`: {a2s, s2a}
 *      - `opamp-client.send.fail`: {a2s, err}
 *      - `opamp-client.send.schedule`: {delayMs, errCount}
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
        this._remoteConfigStatus = create(RemoteConfigStatusSchema, {
            lastRemoteConfigHash: new Uint8Array(0),
            status: RemoteConfigStatuses.RemoteConfigStatuses_UNSET,
        });

        /** @type {AgentToServer} */
        this._numSendFailures = 0;
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
    shutdown() {
        if (this._shutdown) {
            throw new Error('cannot shutdown OpAMPClient multiple times');
        }
        this._shutdown = true;
        if (this._started) {
            this._httpClient.close();
            this._httpClient = null;
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
        const MIN_RETRY_AFTER_MS = 5000;
        const delayMs = Math.max(MIN_RETRY_AFTER_MS, retryAfterMs);
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
     *      schedule send that that is *sooner* for this delayMs.
     */
    _scheduleSend(delayMs, overrideExisting) {
        assert.ok(typeof delayMs === 'number' && delayMs >= 0);

        if (!(this._started && !this._sending && !this._shutdown)) {
            // Invalid to schedule a send in the current state.
            this._log.trace('ignore _scheduleSend');
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
            if (this._diagChs) {
                this._diagChs[DIAG_CH_SEND_SCHEDULE].publish({
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
        const queue = this._queue;
        this._queue = [];
        for (let entry of queue) {
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

        // Retry/backoff behaviour.
        //
        // - The relevant spec sections are "Establishing Connection", "Retrying Messages" and "Throttling", starting at https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#retrying-messages.
        // -

        /*
- sent a2s, get a response s2a or an err
    - (treat all failures the same?)
- if err
    - is this a first status after new connection? How to tell? How to watch
      for reconn? That means a diff kind of err? How about if it was just a
      heartbeat, then base it on that + Retry-After
    - if err without statusCode, that means we didn't even get to an HTTP response
      so it is connection issues: start backoff.
        - calculate backoff starting from current
        - use the same logic from apm/specs/agents/transport.md
            > The new HTTP request should not necessarily be started immediately after the previous HTTP request fails, as the reason for the failure might not have been resolved up-stream. Instead an incremental back-off algorithm SHOULD be used to delay new requests. The grace period should be calculated in seconds using the algorithm `min(reconnectCount++, 6) ** 2 ± 10%`, where `reconnectCount` starts at zero. So the delay after the first error is 0 seconds, then circa 1, 4, 9, 16, 25 and finally 36 seconds. We add ±10% jitter to the calculated grace period in case multiple agents entered the grace period simultaneously. This way they will not all try to reconnect at the same time.
        - Modulo, I wonder about starting with 1s rather than 0s for the first retry.
          Or 5s min (as mentioned at https://github.com/elastic/apm/blob/main/specs/agents/configuration.md#dealing-with-errors)?
        - Also I think the defualt should be longer than 36 seconds. In our experience there have been cases where enough agents overwhelmed with 30s heartbeat, I think. E.g. a slow server than cannot sustain 100 req/s is overwhelmed by conn requests from
        just 1000 agents. So say we increase to about 5min?
    - if err has statusCode, then we got a response at least, so connection was established:
        - reset reconnectCount to 0
        - if HTTP 429 or 503 and Retry-After: then ensure don't send next until
          after Retry-After.  An invalid Retry-After should be treated as empty,
          use the default retry interval (XXX what?).  Should not retry sooner
          than 5s even if Retry-After suggests sooner.
        - else:

# take 2

- if timeout (connTimeout, fullTimeout sep values):
    - TODO: suggest timeout default values, what does enode use?
    - treat same as "unexpected response" below (but watch for HTTP 200, but timeout reading body, TODO: test this)
- if no conn (i.e. a req error, but no res):
    - log.error
    - re-enqueue msg data (i.e. retry)
    - set next send time to exponential backoff(5s ... 5min)
- elif HTTP 200:
        - if unexpected Content-Type: same as "unexpected response" below
        - elif unparsable protobuf in body: same as "unexpected response" below
        - elif s2a.errorResponse:
            - if .type === "Unavailable" and .Details.retryAfterNanoseconds > 0:
                - log.error
                - re-enqueue msg data
                - schedule next send for given time (min 5s)
            - else:
                - log.error
                - backoff 5s...5min (this is NOT a retry because data is dropped, just do next heartbeat per normal)
- elif HTTP 429 or 503 with Retry-After and valid Retry-After value:
    - log.debug if 429, log.error if 503
    - re-enqueue msg data
    - schedule next send for given time (min 5s delay)
- elif HTTP 4xx: This is likely not an OpAMP-capable server. Go into slow poll mode: 5min interval. Mostly this behaviour is to differentiate from the following "unexpected response" case for EDOT SDKs that will attempt to *infer* the OpAMP endpoint from the OTLP endpoint. Getting a 404 from a non-OpAMP-y collector: better to go immediately 5min slow poll than to bother with exponential backoff.
    - log.debug
    - go into slow poll mode where heartbeat interface is ~5min
- else "unexpected response" (includes HTTP 5xx, and currently HTTP 3xx redirects):
    - log.error if 5xx, log.debug otherwise
    - (do no re-enqueue msg data)
    - set next send time to exponential backoff(5s ... 5min)


# take 3

XXX HERE: implement take 3 logic, with tests

- if `client.request()` reject (no conn, XXX includes headersTimeout?): log.error, re-enqueue, schedule with backoff(30s .. 5min)
- if HTTP 429 with valid `Retry-After` header: log.debug, re-enqueue, schedule for given time (min 30s)
- if HTTP 503 with valid `Retry-After` header: log.error, re-enqueue, schedule for given time (min 30s)
- if HTTP != 200 || content-type != protobuf: log.error, re-enqueue, schedule with backoff(30s .. 5min)
- if `await res.body.bytes()` rejection (XXX includes bodyTimeout?): log.error, re-enqueue, schedule with backoff(30s .. 5min)
- if s2a.errorResponse:
    - if .type == "Unavailable" && .Details.retryAfterNanoseconds > 0: log.debug, re-enqueue, schedule for given time (min 30s)
    - else: log.error, re-enqueue, schedule with backoff(30s .. 5min)
- else success: process the `s2a` message


- logging errors:
    - for any of the HTTP 4xx cases, SDK MAY log at debug level
    - for any of the other cases (HTTP 5xx or no conn): SDK SHOULD log at error level


*/
        //
        // TODO: error handling / retry notes
        //
        // AFAICT from https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#retrying-messages
        // the only message that "requires a response" is the initial status.
        // So we only need retry/backoff logic for that first message. All
        // others can rely on heartbeating and the server requesting
        // ReportFullState if it needs.
        // - Plus HTTP 503 and 429 with Retry-After
        // - Plus s2a.errorResponse with RetryInfo
        // - Perhaps use https://undici.nodejs.org/#/docs/api/RetryAgent.md
        //     - `retry` fn holds the logic, can immediate callback(err) for cases
        //     where we don't want retry
        //     - Q: does it already do exp. backoff? Docs don't specify.
        //     - Can errorResponse body with RetryInfo be in here? Probably not
        //     because the request is done then, so manually need to handle
        //     that by ... a re-call into _sendMsg???

        const finishSuccess = () => {
            this._numSendFailures = 0;
            this._sending = false;
            if (this._diagChs) {
                this._diagChs[DIAG_CH_SEND_SUCCESS].publish({a2s, s2a});
            }
            if (this._queue.length > 0) {
                this._scheduleSendSoon();
            } else {
                this._scheduleSendHeartbeat();
            }
        };
        const finishFail = (err) => {
            this._numSendFailures += 1;
            this._sending = false;
            this._queue = queue.concat(this._queue); // Re-enqueue info to send.
            if (this._diagChs) {
                this._diagChs[DIAG_CH_SEND_FAIL].publish({a2s, err});
            }
            this._scheduleSendAfterErr();
        };

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
                // These 10s timeout values were unscientifically chosen.
                headersTimeout: 10 * 1000,
                bodyTimeout: 10 * 1000,
            });
        } catch (reqErr) {
            this._log.error({err: reqErr}, 'HTTP client request threw');
            finishFail(reqErr);
            return;
        }
        if (res.statusCode !== 200) {
            throw new Error(
                `TODO: handle non-200 from OpAMP server: ${res.statusCode} ${res.headers}`
            );
        }
        if (res.headers['content-type'] !== 'application/x-protobuf') {
            throw new Error(
                `TODO: handle unexpectec content-type from OpAMP server: ${res.statusCode} ${res.headers}`
            );
        }
        //  XXX try catch
        const resBody = await res.body.bytes();
        /** @type {ServerToAgent} */
        const s2a = fromBinary(ServerToAgentSchema, resBody);
        this._log.trace({s2a: logserS2A(s2a)}, 'received ServerToAgent');
        if (s2a.errorResponse) {
            throw new Error(
                `TODO: cope with ServerToAgent.errorResponse: ${s2a.errorResponse}`
            );
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
            // TODO doc for user: This `onMessage` callback could be called
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
    DIAG_CH_SEND_SUCCESS,
    DIAG_CH_SEND_FAIL,
    DIAG_CH_SEND_SCHEDULE,
    USER_AGENT,
    createOpAMPClient,
};
