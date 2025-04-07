export type NodeSDKConfiguration = import('@opentelemetry/sdk-node').NodeSDKConfiguration;
export type ElasticNodeSDKOptions = {
    /**
     * - Whether to setup handlers on
     * `process` events to shutdown the SDK. Default true.
     */
    setupShutdownHandlers: boolean;
};
import { getInstrumentations } from "./instrumentations";
/**
 * Create and start an OpenTelemetry NodeSDK.
 *
 * @param {Partial<NodeSDKConfiguration & ElasticNodeSDKOptions>} cfg
 */
export function startNodeSDK(cfg?: Partial<NodeSDKConfiguration & ElasticNodeSDKOptions>): NodeSDK | {
    start(): void;
    shutdown(): Promise<void>;
};
import { createAddHookMessageChannel } from "import-in-the-middle";
import { api } from "@opentelemetry/sdk-node";
import { core } from "@opentelemetry/sdk-node";
import { logs } from "@opentelemetry/sdk-node";
import { metrics } from "@opentelemetry/sdk-node";
import { resources } from "@opentelemetry/sdk-node";
import { tracing } from "@opentelemetry/sdk-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
export { getInstrumentations, createAddHookMessageChannel, api, core, logs, metrics, resources, tracing };
