export type Attributes = import('@opentelemetry/api').Attributes;
export type Context = import('@opentelemetry/api').Context;
export type Link = import('@opentelemetry/api').Link;
export type SpanKind = import('@opentelemetry/api').SpanKind;
export type Sampler = import('@opentelemetry/sdk-trace-base').Sampler;
export type SamplingResult = import('@opentelemetry/sdk-trace-base').SamplingResult;
/**
 * @param {number} ratio
 * @returns {Sampler} A ratio sampler which can have its ratio updated dynamically.
 */
export function createDynamicCompositeParentThresholdTraceIdRatioBasedSampler(ratio?: number): Sampler;
