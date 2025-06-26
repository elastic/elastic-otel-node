export type SpanProcessor = import('@opentelemetry/sdk-trace-base').SpanProcessor;
export type SpanExporter = import('@opentelemetry/sdk-trace-base').SpanExporter;
/**
 * @returns {SpanProcessor[]}
 */
export function getSpanProcessors(): SpanProcessor[];
