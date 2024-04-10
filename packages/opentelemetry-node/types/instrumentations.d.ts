export type Instrumentation = import('@opentelemetry/instrumentation').Instrumentation;
export type InstrumentationFactory = () => Instrumentation;
export type InstrumentaionsMap = {
    "@opentelemetry/instrumentation-bunyan": import('@opentelemetry/instrumentation-bunyan').BunyanInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-http": import('@opentelemetry/instrumentation-http').HttpInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-ioredis": import('@opentelemetry/instrumentation-ioredis').IORedisInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-express": import('@opentelemetry/instrumentation-express').ExpressInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-fastify": import('@opentelemetry/instrumentation-fastify').FastifyInstrumentation | InstrumentationFactory;
    "@opentelemetry/instrumentation-mongodb": import('@opentelemetry/instrumentation-mongodb').MongoDBInstrumentation | InstrumentationFactory;
    "@opentelemetry/instrumentation-pg": import('@opentelemetry/instrumentation-pg').PgInstrumentation | InstrumentationFactory;
    "@opentelemetry/instrumentation-winston": import('@opentelemetry/instrumentation-winston').WinstonInstrumentationConfig | InstrumentationFactory;
};
/**
 * Get the list of instrumentations based on options
 * @param {Partial<InstrumentaionsMap>} [opts={}]
 * @returns {Array<Instrumentation>}
 */
export function getInstrumentations(opts?: Partial<InstrumentaionsMap>): Array<Instrumentation>;
