/** @type {metricsSdk.View[]} */
export const HOST_METRICS_VIEWS: metricsSdk.View[];
export function enableHostMetrics(): void;
import { metrics as metricsSdk } from "@opentelemetry/sdk-node";
declare const View: typeof metricsSdk.View;
export {};
