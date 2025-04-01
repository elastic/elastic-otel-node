export type Instrumentation = import('@opentelemetry/instrumentation').Instrumentation;
export type InstrumentaionsMap = {
    "@elastic/opentelemetry-instrumentation-openai": import('@elastic/opentelemetry-instrumentation-openai').OpenAIInstrumentationConfig;
    "@opentelemetry/instrumentation-amqplib": import('@opentelemetry/instrumentation-amqplib').AmqplibInstrumentation;
    "@opentelemetry/instrumentation-aws-sdk": import('@opentelemetry/instrumentation-aws-sdk').AwsSdkInstrumentationConfig;
    "@opentelemetry/instrumentation-bunyan": import('@opentelemetry/instrumentation-bunyan').BunyanInstrumentationConfig;
    "@opentelemetry/instrumentation-connect": import('@opentelemetry/instrumentation').InstrumentationConfig;
    "@opentelemetry/instrumentation-cassandra-driver": import('@opentelemetry/instrumentation-cassandra-driver').CassandraDriverInstrumentation;
    "@opentelemetry/instrumentation-cucumber": import('@opentelemetry/instrumentation-cucumber').CucumberInstrumentationConfig;
    "@opentelemetry/instrumentation-dataloader": import('@opentelemetry/instrumentation-dataloader').DataloaderInstrumentationConfig;
    "@opentelemetry/instrumentation-dns": import('@opentelemetry/instrumentation-dns').DnsInstrumentationConfig;
    "@opentelemetry/instrumentation-express": import('@opentelemetry/instrumentation-express').ExpressInstrumentationConfig;
    "@opentelemetry/instrumentation-fastify": import('@opentelemetry/instrumentation-fastify').FastifyInstrumentationConfig;
    "@opentelemetry/instrumentation-fs": import('@opentelemetry/instrumentation-fs').FsInstrumentationConfig;
    "@opentelemetry/instrumentation-generic-pool": import('@opentelemetry/instrumentation').InstrumentationConfig;
    "@opentelemetry/instrumentation-graphql": import('@opentelemetry/instrumentation-graphql').GraphQLInstrumentation;
    "@opentelemetry/instrumentation-grpc": import('@opentelemetry/instrumentation-grpc').GrpcInstrumentationConfig;
    "@opentelemetry/instrumentation-hapi": import('@opentelemetry/instrumentation').InstrumentationConfig;
    "@opentelemetry/instrumentation-http": import('@opentelemetry/instrumentation-http').HttpInstrumentationConfig;
    "@opentelemetry/instrumentation-ioredis": import('@opentelemetry/instrumentation-ioredis').IORedisInstrumentationConfig;
    "@opentelemetry/instrumentation-kafkajs": import('@opentelemetry/instrumentation-kafkajs').KafkaJsInstrumentation;
    "@opentelemetry/instrumentation-knex": import('@opentelemetry/instrumentation-knex').KnexInstrumentationConfig;
    "@opentelemetry/instrumentation-koa": import('@opentelemetry/instrumentation-koa').KoaInstrumentationConfig;
    "@opentelemetry/instrumentation-lru-memoizer": import('@opentelemetry/instrumentation').InstrumentationConfig;
    "@opentelemetry/instrumentation-memcached": import('@opentelemetry/instrumentation-memcached').InstrumentationConfig;
    "@opentelemetry/instrumentation-mongodb": import('@opentelemetry/instrumentation-mongodb').MongoDBInstrumentationConfig;
    "@opentelemetry/instrumentation-mongoose": import('@opentelemetry/instrumentation-mongoose').MongooseInstrumentationConfig;
    "@opentelemetry/instrumentation-mysql": import('@opentelemetry/instrumentation-mysql').MySQLInstrumentation;
    "@opentelemetry/instrumentation-mysql2": import('@opentelemetry/instrumentation-mysql2').MySQL2Instrumentation;
    "@opentelemetry/instrumentation-nestjs-core": import('@opentelemetry/instrumentation').InstrumentationConfig;
    "@opentelemetry/instrumentation-net": import('@opentelemetry/instrumentation').InstrumentationConfig;
    "@opentelemetry/instrumentation-pg": import('@opentelemetry/instrumentation-pg').PgInstrumentationConfig;
    "@opentelemetry/instrumentation-pino": import('@opentelemetry/instrumentation-pino').PinoInstrumentationConfig;
    "@opentelemetry/instrumentation-redis": import('@opentelemetry/instrumentation-redis').RedisInstrumentationConfig;
    "@opentelemetry/instrumentation-redis-4": import('@opentelemetry/instrumentation-redis-4').RedisInstrumentationConfig;
    "@opentelemetry/instrumentation-restify": import('@opentelemetry/instrumentation-restify').RestifyInstrumentationConfig;
    "@opentelemetry/instrumentation-router": import('@opentelemetry/instrumentation').InstrumentationConfig;
    "@opentelemetry/instrumentation-runtime-node": import('@opentelemetry/instrumentation-runtime-node').RuntimeNodeInstrumentationConfig;
    "@opentelemetry/instrumentation-socket.io": import('@opentelemetry/instrumentation-socket.io').SocketIoInstrumentationConfig;
    "@opentelemetry/instrumentation-tedious": import('@opentelemetry/instrumentation-tedious').TediousInstrumentationConfig;
    "@opentelemetry/instrumentation-undici": import('@opentelemetry/instrumentation-undici').UndiciInstrumentationConfig;
    "@opentelemetry/instrumentation-winston": import('@opentelemetry/instrumentation-winston').WinstonInstrumentationConfig;
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
