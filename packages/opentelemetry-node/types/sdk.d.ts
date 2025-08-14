export type NodeSDKConfiguration = import('@opentelemetry/sdk-node').NodeSDKConfiguration;
export type ElasticNodeSDKOptions = {
    /**
     * - Whether to setup handlers
     * on `process` events to shutdown the SDK. Default true.
     *
     * Note: To avoid collisions with NodeSDKConfiguration properties, all/most
     * properities of this type should be prefixed with "elastic".
     */
    elasticSetupShutdownHandlers: boolean;
};
import { getInstrumentations } from "./instrumentations";
/**
 * Create and start an OpenTelemetry NodeSDK.
 *
 * While this returns an object with `shutdown()` method, the default behavior
 * is to setup `process.on(...)` handlers to handle shutdown. See the
 * `elasticSetupShutdownHandlers` boolean option.
 *
 * @param {Partial<NodeSDKConfiguration & ElasticNodeSDKOptions>} cfg
 * @returns {{ shutdown(): Promise<void>; }}
 */
export function startNodeSDK(cfg?: Partial<NodeSDKConfiguration & ElasticNodeSDKOptions>): {
    shutdown(): Promise<void>;
};
import { createDynConfSpanExporter } from "./dynconf";
import { createDynConfMetricExporter } from "./dynconf";
import { createDynConfLogRecordExporter } from "./dynconf";
import { createAddHookMessageChannel } from "import-in-the-middle";
import { api } from "@opentelemetry/sdk-node";
import { core } from "@opentelemetry/sdk-node";
import { logs } from "@opentelemetry/sdk-node";
import { metrics } from "@opentelemetry/sdk-node";
import { node } from "@opentelemetry/sdk-node";
import { resources } from "@opentelemetry/sdk-node";
import { tracing } from "@opentelemetry/sdk-node";
export { getInstrumentations, createDynConfSpanExporter, createDynConfMetricExporter, createDynConfLogRecordExporter, createAddHookMessageChannel, api, core, logs, metrics, node, resources, tracing };
