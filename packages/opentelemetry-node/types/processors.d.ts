export type Meter = import('@opentelemetry/api').Meter;
export type UpDownCounter = import('@opentelemetry/api').UpDownCounter;
export type Counter = import('@opentelemetry/api').Counter;
export type SpanProcessor = import('@opentelemetry/sdk-trace-base').SpanProcessor;
export type SpanExporter = import('@opentelemetry/sdk-trace-base').SpanExporter;
/**
 * @param {SpanProcessor[]} [processors]
 */
export function getSpanProcessors(processors?: SpanProcessor[]): import("@opentelemetry/sdk-trace-base").SpanProcessor[];
