import type {NodeSDKConfiguration} from '@opentelemetry/sdk-node';



export type {NodeSDKConfiguration} from '@opentelemetry/sdk-node';


export type {getInstrumentations} from './instrumentations';
// We may want to keep a specific type for configuration
export type ElasticNodeSDKConfiguration = NodeSDKConfiguration;

