/// <reference types="node" />
/// <reference types="node" />
export type AgentDescription = import('./generated/opamp_pb.js').AgentDescription;
export type AgentToServer = import('./generated/opamp_pb.js').AgentToServer;
export type RemoteConfigStatus = import('./generated/opamp_pb.js').RemoteConfigStatus;
export type ServerToAgent = import('./generated/opamp_pb.js').ServerToAgent;
export type AgentRemoteConfig = import('./generated/opamp_pb.js').AgentRemoteConfig;
export type KeyValue = import('./generated/anyvalue_pb.js').KeyValue;
export type AnyValue = import('./generated/anyvalue_pb.js').AnyValue;
export type ArrayValue = import('./generated/anyvalue_pb.js').ArrayValue;
export type OnMessageCallback = (data: OnMessageData) => any;
export type OnMessageData = {
    remoteConfig?: AgentRemoteConfig;
};
export type TLSConnectionOptions = import('tls').ConnectionOptions;
export type ConnectOptions = Pick<TLSConnectionOptions, 'ca'>;
export type OpAMPClientOptions = {
    /**
     * - A logger instance with .trace(), .debug(), etc.
     * methods a la Pino/Bunyan/Luggite.
     */
    log?: any;
    /**
     * - The URL of the OpAMP server, including the
     * path (typically '/v1/opamp').
     */
    endpoint: string;
    /**
     * - Additional HTTP headers to include in requests.
     */
    headers?: any;
    /**
     * - Globally unique identifier
     * for the OpAMP agent. Should be a UUID v7. Could also be set to an OTel
     * 'service.instance.id' resource attribute. If not provided, a UUID v7
     * will generated.
     */
    instanceUid?: Uint8Array | string;
    /**
     * - Bitmask of capabilities to enable.
     * Currently only the following are supported:
     * - ReportsStatus (always on)
     * - ReportsHeartbeat (always on, because using HTTP transport)
     * - AcceptsRemoteConfig
     * - ReportsRemoteConfig
     * It is an error to specify other capabilities.
     * https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#agenttoservercapabilities
     */
    capabilities?: BigInt;
    /**
     * A callback of the form
     * `({remoteConfig}) => {}` that is called when a server response provides
     * data for the client. Currently the only type of data supported is
     * remote config. Receiving remote config requires setting the
     * `AcceptsRemoteConfig` capability in `capabilities`.
     */
    onMessage?: OnMessageCallback;
    /**
     * The approximate time between
     * heartbeat messages sent by the client. Default 30.
     * Clamped to [100ms, 1d].
     */
    heartbeatIntervalSeconds?: number;
    /**
     * The timeout (in milliseconds) to wait
     * for the response headers on a request to the OpAMP server. Default 10s.
     */
    headersTimeout?: number;
    /**
     * The timeout (in milliseconds) to wait for
     * the response body on a request to the OpAMP server. Default 10s.
     */
    bodyTimeout?: number;
    /**
     * A small subset of Undici client connect
     * options (https://undici.nodejs.org/#/docs/api/Client?id=parameter-connectoptions):
     * - 'ca'
     */
    connect?: ConnectOptions;
    /**
     * Diagnostics enabled, typically used for
     * testing. When enabled, events will be published to the following
     * diagnostics channels:
     * - `opamp-client.send.success`: {a2s, s2a}
     * - `opamp-client.send.fail`: {a2s, err, retryAfterMs}
     * - `opamp-client.send.schedule`: {delayMs, errCount}
     *
     * TODO: enableCompression or similar option
     * TODO: add {ConnectionOptions} [connect] with a subset of https://undici.nodejs.org/#/docs/api/Client?id=parameter-connectoptions e.g. as used in play.mjs for `ca: [cacert]` to conn to opamp-go example server. Or could expose the full ConnectOptions, but that's heavy.
     */
    diagEnabled?: boolean;
};
export const DIAG_CH_SEND_SUCCESS: "opamp-client.send.success";
export const DIAG_CH_SEND_FAIL: "opamp-client.send.fail";
export const DIAG_CH_SEND_SCHEDULE: "opamp-client.send.schedule";
export const USER_AGENT: string;
/**
 * @param {OpAMPClientOptions} opts
 */
export function createOpAMPClient(opts: OpAMPClientOptions): OpAMPClient;
/**
 * @callback OnMessageCallback
 * @param {OnMessageData} data
 */
/**
 * @typedef {Object} OnMessageData
 * @property {AgentRemoteConfig} [remoteConfig]
 */
/**
 * @typedef {import('tls').ConnectionOptions} TLSConnectionOptions
 */
/**
 * @typedef {Pick<TLSConnectionOptions, 'ca'>} ConnectOptions
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
 *      options (https://undici.nodejs.org/#/docs/api/Client?id=parameter-connectoptions):
 *          - 'ca'
 * @property {boolean} [diagEnabled] Diagnostics enabled, typically used for
 *      testing. When enabled, events will be published to the following
 *      diagnostics channels:
 *      - `opamp-client.send.success`: {a2s, s2a}
 *      - `opamp-client.send.fail`: {a2s, err, retryAfterMs}
 *      - `opamp-client.send.schedule`: {delayMs, errCount}
 *
 * TODO: enableCompression or similar option
 * TODO: add {ConnectionOptions} [connect] with a subset of https://undici.nodejs.org/#/docs/api/Client?id=parameter-connectoptions e.g. as used in play.mjs for `ca: [cacert]` to conn to opamp-go example server. Or could expose the full ConnectOptions, but that's heavy.
 */
declare class OpAMPClient {
    /**
     * @param {OpAMPClientOptions} opts
     */
    constructor(opts: OpAMPClientOptions);
    _log: any;
    _endpoint: import("url").URL;
    _headers: any;
    _sequenceNum: bigint;
    _instanceUid: Uint8Array;
    _instanceUidStr: string;
    _capabilities: bigint;
    _heartbeatIntervalMs: number;
    _onMessage: OnMessageCallback;
    _diagChs: {
        "opamp-client.send.success": import("diagnostics_channel").Channel<unknown, unknown>;
        "opamp-client.send.fail": import("diagnostics_channel").Channel<unknown, unknown>;
        "opamp-client.send.schedule": import("diagnostics_channel").Channel<unknown, unknown>;
    };
    _diagEnabled: boolean;
    _started: boolean;
    _shutdown: boolean;
    _serverCapabilities: any;
    /** @type {AgentDescription} */
    _agentDescription: AgentDescription;
    _remoteConfigStatus: import("./generated/opamp_pb").RemoteConfigStatus;
    _numSendFailures: number;
    _nextSendTime: number;
    _nextSendTimeout: NodeJS.Timeout;
    _queue: any[];
    _httpClient: undici.Client;
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
    setAgentDescription(desc: {
        identifyingAttributes?: object;
        nonIdentifyingAttributes?: object;
    }): void;
    _agentDescriptionSer: any;
    /**
     * Dev Note: This client manages the `instanceUid`, so I'm not sure if this
     * API method is useful. The instanceUid *can* be changed by the OpAMP
     * server.
     */
    getInstanceUid(): Uint8Array;
    start(): void;
    /**
     * Do an orderly shutdown.
     * A shutdown OpAMPClient cannot be restarted.
     */
    shutdown(): Promise<void>;
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
    setRemoteConfigStatus(remoteConfigStatus: RemoteConfigStatus): void;
    _hasCapReportsRemoteConfig(): bigint;
    _hasCapAcceptsRemoteConfig(): bigint;
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
    _scheduleSendSoon(): void;
    _scheduleSendHeartbeat(): void;
    /**
     * @param {number} retryAfterMs
     */
    _scheduleSendRetryAfter(retryAfterMs: number): void;
    _scheduleSendAfterErr(): void;
    /**
     * This should only be called by the other `_scheduleSend*` methods above.
     *
     * @param {number} delayMs
     * @param {boolean} overrideExisting - Whether to override an existing
     *      scheduled send, even if the existing one is *sooner* that the given
     *      delayMs.
     */
    _scheduleSend(delayMs: number, overrideExisting: boolean): void;
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
    _sendMsg(): Promise<void>;
    _sending: boolean;
    /**
     * @param {ServerToAgent} s2a
     */
    _processServerToAgent(s2a: ServerToAgent): void;
}
import undici = require("undici");
export {};
