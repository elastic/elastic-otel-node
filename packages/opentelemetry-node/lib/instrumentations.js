/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {
    getStringListFromEnv,
    getBooleanFromEnv,
} = require('@opentelemetry/core');
const {log} = require('./logging');

/**
 * @typedef {import('@opentelemetry/instrumentation').Instrumentation} Instrumentation
 *
 * @callback InstrumentationFactory
 * @returns {Instrumentation}
 *
 * @typedef {{
 *  "@elastic/opentelemetry-instrumentation-openai": import('@elastic/opentelemetry-instrumentation-openai').OpenAIInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-amqplib": import('@opentelemetry/instrumentation-amqplib').AmqplibInstrumentation | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-aws-sdk": import('@opentelemetry/instrumentation-aws-sdk').AwsSdkInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-bunyan": import('@opentelemetry/instrumentation-bunyan').BunyanInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-connect": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-cassandra-driver": import('@opentelemetry/instrumentation-cassandra-driver').CassandraDriverInstrumentation | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-cucumber": import('@opentelemetry/instrumentation-cucumber').CucumberInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-dataloader": import('@opentelemetry/instrumentation-dataloader').DataloaderInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-dns": import('@opentelemetry/instrumentation-dns').DnsInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-express": import('@opentelemetry/instrumentation-express').ExpressInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-fastify": import('@opentelemetry/instrumentation-fastify').FastifyInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-fs": import('@opentelemetry/instrumentation-fs').FsInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-generic-pool": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-graphql": import('@opentelemetry/instrumentation-graphql').GraphQLInstrumentation | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-grpc": import('@opentelemetry/instrumentation-grpc').GrpcInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-hapi": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-http": import('@opentelemetry/instrumentation-http').HttpInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-ioredis": import('@opentelemetry/instrumentation-ioredis').IORedisInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-kafkajs": import('@opentelemetry/instrumentation-kafkajs').KafkaJsInstrumentation | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-knex": import('@opentelemetry/instrumentation-knex').KnexInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-koa": import('@opentelemetry/instrumentation-koa').KoaInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-lru-memoizer": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-memcached": import('@opentelemetry/instrumentation-memcached').InstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-mongodb": import('@opentelemetry/instrumentation-mongodb').MongoDBInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-mongoose": import('@opentelemetry/instrumentation-mongoose').MongooseInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-mysql": import('@opentelemetry/instrumentation-mysql').MySQLInstrumentation | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-mysql2": import('@opentelemetry/instrumentation-mysql2').MySQL2Instrumentation | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-nestjs-core": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-net": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-pg": import('@opentelemetry/instrumentation-pg').PgInstrumentationConfig | InstrumentationFactory
 *  "@opentelemetry/instrumentation-pino": import('@opentelemetry/instrumentation-pino').PinoInstrumentationConfig | InstrumentationFactory
 *  "@opentelemetry/instrumentation-redis": import('@opentelemetry/instrumentation-redis').RedisInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-redis-4": import('@opentelemetry/instrumentation-redis-4').RedisInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-restify": import('@opentelemetry/instrumentation-restify').RestifyInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-router": import('@opentelemetry/instrumentation').InstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-runtime-node": import('@opentelemetry/instrumentation-runtime-node').RuntimeNodeInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-socket.io": import('@opentelemetry/instrumentation-socket.io').SocketIoInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-tedious": import('@opentelemetry/instrumentation-tedious').TediousInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-undici": import('@opentelemetry/instrumentation-undici').UndiciInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-winston": import('@opentelemetry/instrumentation-winston').WinstonInstrumentationConfig | InstrumentationFactory,
 * }} InstrumentaionsMap
 */

/* eslint-disable prettier/prettier */
const {OpenAIInstrumentation} = require('@elastic/opentelemetry-instrumentation-openai');
const {AwsInstrumentation} = require('@opentelemetry/instrumentation-aws-sdk');
const {AmqplibInstrumentation} = require('@opentelemetry/instrumentation-amqplib');
const {BunyanInstrumentation} = require('@opentelemetry/instrumentation-bunyan');
const {ConnectInstrumentation} = require('@opentelemetry/instrumentation-connect');
const {CassandraDriverInstrumentation} = require('@opentelemetry/instrumentation-cassandra-driver');
const {CucumberInstrumentation} = require('@opentelemetry/instrumentation-cucumber');
const {DataloaderInstrumentation} = require('@opentelemetry/instrumentation-dataloader');
const {DnsInstrumentation} = require('@opentelemetry/instrumentation-dns');
const {ExpressInstrumentation} = require('@opentelemetry/instrumentation-express');
const {FsInstrumentation} = require('@opentelemetry/instrumentation-fs');
const {FastifyInstrumentation} = require('@opentelemetry/instrumentation-fastify');
const {GenericPoolInstrumentation} = require('@opentelemetry/instrumentation-generic-pool');
const {GraphQLInstrumentation} = require('@opentelemetry/instrumentation-graphql');
const {GrpcInstrumentation} = require('@opentelemetry/instrumentation-grpc');
const {HapiInstrumentation} = require('@opentelemetry/instrumentation-hapi');
const {HttpInstrumentation} = require('@opentelemetry/instrumentation-http');
const {IORedisInstrumentation} = require('@opentelemetry/instrumentation-ioredis');
const {KnexInstrumentation} = require('@opentelemetry/instrumentation-knex');
const {KafkaJsInstrumentation} = require('@opentelemetry/instrumentation-kafkajs');
const {KoaInstrumentation} = require('@opentelemetry/instrumentation-koa');
const {LruMemoizerInstrumentation} = require('@opentelemetry/instrumentation-lru-memoizer');
const {MemcachedInstrumentation} = require('@opentelemetry/instrumentation-memcached');
const {MongoDBInstrumentation} = require('@opentelemetry/instrumentation-mongodb');
const {MongooseInstrumentation} = require('@opentelemetry/instrumentation-mongoose');
const {MySQLInstrumentation} = require('@opentelemetry/instrumentation-mysql');
const {MySQL2Instrumentation} = require('@opentelemetry/instrumentation-mysql2');
const {NestInstrumentation} = require('@opentelemetry/instrumentation-nestjs-core');
const {NetInstrumentation} = require('@opentelemetry/instrumentation-net');
const {PgInstrumentation} = require('@opentelemetry/instrumentation-pg');
const {PinoInstrumentation} = require('@opentelemetry/instrumentation-pino');
const {RedisInstrumentation} = require('@opentelemetry/instrumentation-redis');
const {RedisInstrumentation: RedisFourInstrumentation} = require('@opentelemetry/instrumentation-redis-4');
const {RestifyInstrumentation} = require('@opentelemetry/instrumentation-restify');
const {RouterInstrumentation} = require('@opentelemetry/instrumentation-router');
const {RuntimeNodeInstrumentation} = require('@opentelemetry/instrumentation-runtime-node');
const {SocketIoInstrumentation} = require('@opentelemetry/instrumentation-socket.io');
const {TediousInstrumentation} = require('@opentelemetry/instrumentation-tedious');
const {UndiciInstrumentation} = require('@opentelemetry/instrumentation-undici');
const {WinstonInstrumentation} = require('@opentelemetry/instrumentation-winston');

// Instrumentations attach their Hook (for require-in-the-middle or import-in-the-middle)
// when the `enable` method is called and this happens inside their constructor
// https://github.com/open-telemetry/opentelemetry-js/blob/1b4999f386e0240b7f65350e8360ccc2930b0fe6/experimental/packages/opentelemetry-instrumentation/src/platform/node/instrumentation.ts#L71
//
// The SDK cannot construct any instrumentation until it has resolved the config. So to
// do a lazy creation of instrumentations we have factory functions that can receive
// the user's config and can default to something else if needed.
/** @type {Record<keyof InstrumentaionsMap, (cfg: any) => Instrumentation>} */
const instrumentationsMap = {
    '@elastic/opentelemetry-instrumentation-openai': (cfg) => new OpenAIInstrumentation(cfg),
    '@opentelemetry/instrumentation-amqplib': (cfg) => new AmqplibInstrumentation(cfg),
    '@opentelemetry/instrumentation-aws-sdk': (cfg) => new AwsInstrumentation(cfg),
    '@opentelemetry/instrumentation-bunyan': (cfg) => new BunyanInstrumentation(cfg),
    '@opentelemetry/instrumentation-connect': (cfg) => new ConnectInstrumentation(cfg),
    '@opentelemetry/instrumentation-cassandra-driver': (cfg) => new CassandraDriverInstrumentation(cfg),
    '@opentelemetry/instrumentation-cucumber': (cfg) => new CucumberInstrumentation(cfg),
    '@opentelemetry/instrumentation-dataloader': (cfg) => new DataloaderInstrumentation(cfg),
    '@opentelemetry/instrumentation-dns': (cfg) => new DnsInstrumentation(cfg),
    '@opentelemetry/instrumentation-express': (cfg) => new ExpressInstrumentation(cfg),
    '@opentelemetry/instrumentation-fastify': (cfg) => new FastifyInstrumentation(cfg),
    '@opentelemetry/instrumentation-fs': (cfg) => new FsInstrumentation(cfg),
    '@opentelemetry/instrumentation-generic-pool': (cfg) => new GenericPoolInstrumentation(cfg),
    '@opentelemetry/instrumentation-graphql': (cfg) => new GraphQLInstrumentation(cfg),
    '@opentelemetry/instrumentation-grpc': (cfg) => new GrpcInstrumentation(cfg),
    '@opentelemetry/instrumentation-hapi': (cfg) => new HapiInstrumentation(cfg),
    '@opentelemetry/instrumentation-http': (cfg) => new HttpInstrumentation(cfg),
    '@opentelemetry/instrumentation-ioredis': (cfg) => new IORedisInstrumentation(cfg),
    '@opentelemetry/instrumentation-knex': (cfg) => new KnexInstrumentation(cfg),
    '@opentelemetry/instrumentation-kafkajs': (cfg) => new KafkaJsInstrumentation(cfg),
    '@opentelemetry/instrumentation-koa': (cfg) => new KoaInstrumentation(cfg),
    '@opentelemetry/instrumentation-lru-memoizer': (cfg) => new LruMemoizerInstrumentation(cfg),
    '@opentelemetry/instrumentation-memcached': (cfg) => new MemcachedInstrumentation(cfg),
    '@opentelemetry/instrumentation-mongodb': (cfg) => new MongoDBInstrumentation(cfg),
    '@opentelemetry/instrumentation-mongoose': (cfg) => new MongooseInstrumentation(cfg),
    '@opentelemetry/instrumentation-mysql': (cfg) => new MySQLInstrumentation(cfg),
    '@opentelemetry/instrumentation-mysql2': (cfg) => new MySQL2Instrumentation(cfg),
    '@opentelemetry/instrumentation-nestjs-core': (cfg) => new NestInstrumentation(cfg),
    '@opentelemetry/instrumentation-net': (cfg) => new NetInstrumentation(cfg),
    '@opentelemetry/instrumentation-pg': (cfg) => new PgInstrumentation(cfg),
    '@opentelemetry/instrumentation-pino': (cfg) => new PinoInstrumentation(cfg),
    '@opentelemetry/instrumentation-redis': (cfg) => new RedisInstrumentation(cfg),
    '@opentelemetry/instrumentation-redis-4': (cfg) => new RedisFourInstrumentation(cfg),
    '@opentelemetry/instrumentation-restify': (cfg) => new RestifyInstrumentation(cfg),
    '@opentelemetry/instrumentation-router': (cfg) => new RouterInstrumentation(cfg),
    '@opentelemetry/instrumentation-runtime-node': (cfg) => new RuntimeNodeInstrumentation(cfg),
    '@opentelemetry/instrumentation-socket.io': (cfg) => new SocketIoInstrumentation(cfg),
    '@opentelemetry/instrumentation-tedious': (cfg) => new TediousInstrumentation(cfg),
    '@opentelemetry/instrumentation-undici': (cfg) => new UndiciInstrumentation(cfg),
    '@opentelemetry/instrumentation-winston': (cfg) => new WinstonInstrumentation(cfg),
};
/* eslint-enable prettier/prettier */

const excludedInstrumentations = new Set([
    '@opentelemetry/instrumentation-fastify',
    '@opentelemetry/instrumentation-fs',
]);

const otelInstrPrefix = '@opentelemetry/instrumentation-';
const otelInstrShortNames = new Set();
const nonOtelInstrNames = new Set();
for (const name of Object.keys(instrumentationsMap)) {
    if (name.startsWith(otelInstrPrefix)) {
        otelInstrShortNames.add(name.replace(otelInstrPrefix, ''));
    } else {
        nonOtelInstrNames.add(name);
    }
}

/**
 * Reads a string in the format `value1,value2` and parses
 * it into an array. This is the format specified for comma separated
 * list for OTEL environment vars. Example:
 * https://opentelemetry.io/docs/languages/sdk-configuration/general/#otel_propagators
 *
 * If the param is not defined or falsy it returns an empty array. The resulting
 * array has only nonempty string.
 *
 * @param {string} envvar
 * @returns {Array<string> | undefined}
 */
function getInstrumentationsFromEnv(envvar) {
    const names = getStringListFromEnv(envvar);
    if (names) {
        const instrumentations = [];

        for (const name of names) {
            if (otelInstrShortNames.has(name)) {
                instrumentations.push(`${otelInstrPrefix}${name}`);
            } else if (nonOtelInstrNames.has(name)) {
                instrumentations.push(name);
            } else {
                log.warn(
                    `Unknown instrumentation "${name}" specified in the environment variable ${envvar}`
                );
            }
        }

        return instrumentations;
    }

    return undefined;
}

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
function getInstrumentations(opts = {}) {
    /** @type {Array<Instrumentation>} */
    const instrumentations = [];
    const enabledFromEnv = getInstrumentationsFromEnv(
        'OTEL_NODE_ENABLED_INSTRUMENTATIONS'
    );
    const disabledFromEnv = getInstrumentationsFromEnv(
        'OTEL_NODE_DISABLED_INSTRUMENTATIONS'
    );

    // `@opentelemetry/instrumentation-http` defaults to emit old semconv attributes.
    // Set the default to stable HTTP semconv if not defined by the user (http, http/dup)
    // TODO: remove this once https://github.com/open-telemetry/opentelemetry-js/pull/5552
    // is merged and published.
    const semconvOptIn =
        getStringListFromEnv('OTEL_SEMCONV_STABILITY_OPT_IN') || [];
    if (!semconvOptIn.includes('http') && !semconvOptIn.includes('http/dup')) {
        semconvOptIn.push('http');
        process.env.OTEL_SEMCONV_STABILITY_OPT_IN = semconvOptIn.join(',');
    }

    const defaultInstrConfigFromName = {};
    // Handle `ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING`. The user must opt-in to
    // the "log sending" feature of the OTel log framework instrumentations
    // (pino, bunyan, winston). This *differs* from OTel JS, but matches
    // OTel Java Agent behaviour.
    //
    // This sets a default `{disableLogSending: true}` default config for
    // `instrumentation-{bunyan,pino,winston}`.
    //
    // See: https://github.com/elastic/elastic-otel-node/issues/680
    // TODO: link instead to configuration doc for this when have it.
    const enableLogSending = getBooleanFromEnv(
        'ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING'
    );
    if (!enableLogSending) {
        const logInstrNames = ['bunyan', 'pino', 'winston'];
        logInstrNames.forEach((name) => {
            defaultInstrConfigFromName[
                `@opentelemetry/instrumentation-${name}`
            ] = {disableLogSending: true};
        });
    }

    // TODO: check `opts` and warn if it includes entries for unknown instrumentations (this is what `checkManuallyProvidedInstrumentationNames` does in auto-instrumentations-node).

    Object.keys(instrumentationsMap).forEach((name) => {
        // Skip if env has an `enabled` list and does not include this one
        if (enabledFromEnv && !enabledFromEnv.includes(name)) {
            return;
        }
        // Skip if env has an `disabled` list and it's present (overriding enabled list)
        if (disabledFromEnv && disabledFromEnv.includes(name)) {
            return;
        }

        // Skip if metrics are disabled by env var
        const isMetricsDisabled =
            getBooleanFromEnv('ELASTIC_OTEL_METRICS_DISABLED') ?? false;
        if (
            isMetricsDisabled &&
            name === '@opentelemetry/instrumentation-runtime-node'
        ) {
            return;
        }

        const isObject = typeof opts[name] === 'object';
        if (!(opts[name] == null || isObject)) {
            log.warn(
                {instrConfig: opts[name]},
                `invalid value for getInstrumentations() '${name}' option: must be object, got ${typeof opts[
                    name
                ]}`
            );
        }
        let instrConfig = isObject ? opts[name] : undefined;
        instrConfig = {...defaultInstrConfigFromName[name], ...instrConfig};

        // We should instantiate a instrumentation:
        // - if set via OTEL_NODE_ENABLED_INSTRUMENTATIONS
        //      - overriding any config that might be passed
        //      NOTE: factories are not overwritten
        // - otherwise
        //      - if there is no config passed (elastic SDK will use its defaults)
        //      - if the configuration passed is not disabling it
        let instr;

        if (enabledFromEnv) {
            instrConfig = {...instrConfig, enabled: true};
        } else if (excludedInstrumentations.has(name)) {
            // if excluded instrumentations not present in envvar the instrumentation
            // is disabled unless an explicit config says the opposite
            // ref: https://github.com/open-telemetry/opentelemetry-js-contrib/pull/2467
            instrConfig = {enabled: false, ...instrConfig};
        }

        if (!instrConfig || instrConfig.enabled !== false) {
            instr = instrumentationsMap[name](instrConfig);
        }

        if (instr) {
            // Note that this doesn't log *functions* in instrConfig.
            log.debug({instrConfig}, `Enabling instrumentation "${name}"`);
            instrumentations.push(instr);
        }
    });

    return instrumentations;
}

module.exports = {
    getInstrumentations,
};
