/**
 * @typedef {import('@opentelemetry/instrumentation').Instrumentation} Instrumentation
 *
 * @callback InstrumentationFactory
 * @returns {Instrumentation}
 *
 * @typedef {{
 *  "@opentelemetry/instrumentation-bunyan": import('@opentelemetry/instrumentation-bunyan').BunyanInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-http": import('@opentelemetry/instrumentation-http').HttpInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-ioredis": import('@opentelemetry/instrumentation-ioredis').IORedisInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-express": import('@opentelemetry/instrumentation-express').ExpressInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-fastify": import('@opentelemetry/instrumentation-fastify').FastifyInstrumentation | InstrumentationFactory
 *  "@opentelemetry/instrumentation-pg": import('@opentelemetry/instrumentation-pg').PgInstrumentation | InstrumentationFactory
 * }} InstrumentaionsMap
 */

const {
    BunyanInstrumentation,
} = require('@opentelemetry/instrumentation-bunyan');
const {HttpInstrumentation} = require('@opentelemetry/instrumentation-http');
const {
    IORedisInstrumentation,
} = require('@opentelemetry/instrumentation-ioredis');
const {
    ExpressInstrumentation,
} = require('@opentelemetry/instrumentation-express');
const {
    FastifyInstrumentation,
} = require('@opentelemetry/instrumentation-fastify');
const {PgInstrumentation} = require('@opentelemetry/instrumentation-pg');

// Instrumentations attach their Hook (for require-in-the-middle or import-in-the-middle)
// when the `enable` method is called and this happens inside their constructor
// https://github.com/open-telemetry/opentelemetry-js/blob/1b4999f386e0240b7f65350e8360ccc2930b0fe6/experimental/packages/opentelemetry-instrumentation/src/platform/node/instrumentation.ts#L71
//
// The SDK cannot construct any instrumentation until it has resolved the config. So to
// do a lazy creation of instrumentations we have factory functions that can receive
// the user's config and can default to something else if needed.
/** @type {Record<keyof InstrumentaionsMap, (cfg: any) => Instrumentation>} */
const INSTRUMENTATIONS = {
    '@opentelemetry/instrumentation-bunyan': (cfg) =>
        new BunyanInstrumentation(cfg),
    '@opentelemetry/instrumentation-express': (cfg) =>
        new ExpressInstrumentation(cfg),
    '@opentelemetry/instrumentation-fastify': (cfg) =>
        new FastifyInstrumentation(cfg),
    '@opentelemetry/instrumentation-http': (cfg) =>
        new HttpInstrumentation(cfg),
    '@opentelemetry/instrumentation-ioredis': (cfg) =>
        new IORedisInstrumentation(cfg),
    '@opentelemetry/instrumentation-pg': (cfg) => new PgInstrumentation(cfg),
};

/**
 * Get the list of instrumentations baed on options
 * @param {Partial<InstrumentaionsMap>} [opts={}]
 * @returns {Array<Instrumentation>}
 */
function getInstrumentations(opts = {}) {
    /** @type {Array<Instrumentation>} */
    const instrumentations = [];

    Object.keys(INSTRUMENTATIONS).forEach((name) => {
        const isFactory = typeof opts[name] === 'function';
        const isObject = typeof opts[name] === 'object';
        const instrFactory = isFactory ? opts[name] : INSTRUMENTATIONS[name];
        const instrConfig = isObject ? opts[name] : undefined;

        // We should instantiate a instrumentation if:
        // - there is no config passed (elastic SDK will use its defaults)
        // - the configuration passed is not disabling it
        let instr;
        if (!instrConfig || instrConfig.enabled !== false) {
            instr = instrFactory(instrConfig);
        }

        if (instr) {
            instrumentations.push(instr);
        }
    });

    return instrumentations;
}

module.exports = {
    getInstrumentations,
};
