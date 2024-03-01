import type {Instrumentation} from '@opentelemetry/instrumentation';
import type {NodeSDKConfiguration} from '@opentelemetry/sdk-node';

interface InstrumentationUseProvider {
  for: string;
  use: () => Instrumentation | undefined;
}
type InstrumentationProvider = Instrumentation | InstrumentationUseProvider;

export type {NodeSDKConfiguration} from '@opentelemetry/sdk-node';
export type {Instrumentation} from '@opentelemetry/instrumentation';
export type ElasticNodeSDKConfiguration = NodeSDKConfiguration & {
  instrumentationProviders: Array<InstrumentationProvider>
}
