export type Instrumentation = import('@opentelemetry/instrumentation').Instrumentation;
export type InstrumentationFactory = () => Instrumentation;
export type InstrumentaionsMap = {
    "@opentelemetry/instrumentation-aws-sdk": import('@opentelemetry/instrumentation-aws-sdk').AwsSdkInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-bunyan": import('@opentelemetry/instrumentation-bunyan').BunyanInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-connect": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-cucumber": import('@opentelemetry/instrumentation-cucumber').CucumberInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-dataloader": import('@opentelemetry/instrumentation-dataloader').DataloaderInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-dns": import('@opentelemetry/instrumentation-dns').DnsInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-express": import('@opentelemetry/instrumentation-express').ExpressInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-fastify": import('@opentelemetry/instrumentation-fastify').FastifyInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-generic-pool": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-grpc": import('@opentelemetry/instrumentation-grpc').GrpcInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-hapi": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-http": import('@opentelemetry/instrumentation-http').HttpInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-ioredis": import('@opentelemetry/instrumentation-ioredis').IORedisInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-knex": import('@opentelemetry/instrumentation-knex').KnexInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-koa": import('@opentelemetry/instrumentation-koa').KoaInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-lru-memoizer": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-memcached": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-mongodb": import('@opentelemetry/instrumentation-mongodb').MongoDBInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-nestjs-core": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-net": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-pg": import('@opentelemetry/instrumentation-pg').PgInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-pino": import('@opentelemetry/instrumentation-pino').PinoInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-redis-4": import('@opentelemetry/instrumentation-redis-4').RedisInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-restify": import('@opentelemetry/instrumentation-restify').RestifyInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-router": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-socket.io": import('@opentelemetry/instrumentation-socket.io').SocketIoInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-tedious": import('@opentelemetry/instrumentation-tedious').TediousInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-undici": import('@opentelemetry/instrumentation-undici').UndiciInstrumentationConfig | InstrumentationFactory;
    "@opentelemetry/instrumentation-winston": import('@opentelemetry/instrumentation-winston').WinstonInstrumentationConfig | InstrumentationFactory;
};
/**
 * With this method you can disable, configure and replace the instrumentations
 * supported by ElastiNodeSDK. The result is an array of all the
 * active instrumentations based on the options parameter which is an object
 * of `instrumentation_name` as keys and objects or functions as values.
 * - if instrumentation name is not present in keys default instrumentation is
 *   returned
 * - if instrumentation name is present in keys and has an object as value this
 *   will be used as configuration. Note you can disable with `{ enable: false }`
 * - if instrumentation name is present in keys and has an function as value this
 *   will be used as a factory and the object retuned by th function will replace
 *   the instrumentation
 *
 * You can use this function if are developing your own telemetry script as an aid
 * to configure your instrumentations array
 *
 * Example:
 *
 * ```js
 * const customInstrumentations = getInstrumentations({
 *      // HTTP instrumentation will get a specific config
 *     '@opentelemetry/instrumentation-http': {
 *          serverName: 'foo'
 *      },
 *      // Express insrumentation will be disabled and not returned
 *      '@opentelemetry/instrumentation-express': {
 *          enabled: false,
 *      },
 *      // You can replace a instrumentation by using a funciton
 *      '@opentelemetry/instrumentation-mongodb': () => {
 *          return new MyMongoDBInstrumentation();
 *      }
 * });
 *
 * const sdk = new ElasticNodeSDK({
 *      instrumentations: [
 *          ...customInstrumentations,
 *          // You can add here instrumentations from other sources
 *      ]
 * });
 * ```
 *
 * @param {Partial<InstrumentaionsMap>} [opts={}]
 * @returns {Array<Instrumentation>}
 */
export function getInstrumentations(opts?: Partial<InstrumentaionsMap>): Array<Instrumentation>;
