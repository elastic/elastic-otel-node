/**
 * @typedef {import('@opentelemetry/instrumentation').Instrumentation} Instrumentation
 *
 * @callback InstrumentationFactory
 * @returns {Instrumentation}
 *
 * @typedef {{
 *  "@opentelemetry/instrumentation-http": import('@opentelemetry/instrumentation-http').HttpInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-express": import('@opentelemetry/instrumentation-express').ExpressInstrumentationConfig | InstrumentationFactory
 * }} InstrumentaionsMap
 */

const {HttpInstrumentation} = require('@opentelemetry/instrumentation-http');
const {
    ExpressInstrumentation,
} = require('@opentelemetry/instrumentation-express');

// Instrumentations attach their Hook (for require-in-the-middle or import-in-the-middle)
// when the `enable` method is called and this happens inside their constructor
// https://github.com/open-telemetry/opentelemetry-js/blob/1b4999f386e0240b7f65350e8360ccc2930b0fe6/experimental/packages/opentelemetry-instrumentation/src/platform/node/instrumentation.ts#L71
//
// The SDK cannot construct any instrumentation until it has resolved the config. So to
// do a lazy creation of instrumentations we have factory functions that can receive
// the user's config and can default to something else if needed.
/** @type {Record<keyof InstrumentaionsMap, (cfg: any) => Instrumentation>} */
const INSTRUMENTATIONS = {
    '@opentelemetry/instrumentation-http': (cfg) =>
        new HttpInstrumentation(cfg),
    '@opentelemetry/instrumentation-express': (cfg) =>
        new ExpressInstrumentation(cfg),
};

/**
 * Get the list of instrumentations baed on options
 * @param {Partial<InstrumentaionsMap>} [opts]
 * @returns {Array<Instrumentation>}
 */
function getInstrumentations(opts) {
    /** @type {Array<Instrumentation>} */
    const instrumentations = [];
    Object.keys(INSTRUMENTATIONS).forEach((name) => {
        const isFactory = typeof opts[name] === 'function';
        const isObject = typeof opts[name] === 'object';
        const instrFactory = isFactory ? opts[name] : INSTRUMENTATIONS[name];
        const instrConfig = isObject ? opts[name] : undefined;

        // We should add a instrumentation if:
        // - there is no config passed (elastic SDK will use its defaults)
        // - the configuraiton passed is not disabling it
        if (!instrConfig || instrConfig.enabled !== false) {
            instrumentations.push(instrFactory(instrConfig));
        }
    });

    return instrumentations;
}

module.exports = {
    getInstrumentations,
};
