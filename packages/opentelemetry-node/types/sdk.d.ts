export type NodeSDKConfiguration = import('@opentelemetry/sdk-node').NodeSDKConfiguration;
export class ElasticNodeSDK extends NodeSDK {
    /** @private */
    private _metricsDisabled;
    /** @private */
    private _log;
}
import { NodeSDK } from "@opentelemetry/sdk-node/build/src/sdk";
