export type Meter = import('@opentelemetry/api').Meter;
export type UpDownCounter = import('@opentelemetry/api').UpDownCounter;
export type Counter = import('@opentelemetry/api').Counter;
export type Span = import('@opentelemetry/sdk-trace-base').Span;
export type ReadableSpan = import('@opentelemetry/sdk-trace-base').ReadableSpan;
export type SpanProcessor = import('@opentelemetry/sdk-trace-base').SpanProcessor;
/**
 *
 * @param {Partial<import('@opentelemetry/sdk-node').NodeSDKConfiguration>} cfg
 * @returns
 */
export function setupSdkMetrics(cfg: Partial<import('@opentelemetry/sdk-node').NodeSDKConfiguration>): void;
