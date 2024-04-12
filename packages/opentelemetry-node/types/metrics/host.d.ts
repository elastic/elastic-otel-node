export type HrTime = import('@opentelemetry/api').HrTime;
/**
 * <T>
 */
export type Aggregator<T> = import('@opentelemetry/sdk-metrics/build/src/aggregator/types').Aggregator<T>;
/**
 * <T>
 */
export type AccumulationRecord<T> = import('@opentelemetry/sdk-metrics/build/src/aggregator/types').AccumulationRecord<T>;
export type LastValueAggregation = import('@opentelemetry/sdk-metrics').LastValueAggregation;
export type Accumulation = import('@opentelemetry/sdk-metrics/build/src/aggregator/types').Accumulation;
export type MetricDescriptor = import('@opentelemetry/sdk-metrics').MetricDescriptor;
export type AggregationTemporality = import('@opentelemetry/sdk-metrics').AggregationTemporality;
export type GaugeMetricData = import('@opentelemetry/sdk-metrics').GaugeMetricData;
/** @type {metrics.View[]} */
export const HOST_METRICS_VIEWS: metrics.View[];
export function enableHostMetrics(): void;
import { metrics } from "@opentelemetry/sdk-node";
declare const View: typeof metrics.View;
export {};
