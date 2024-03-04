const {HttpInstrumentation} = require('@opentelemetry/instrumentation-http');
const {
    ExpressInstrumentation,
} = require('@opentelemetry/instrumentation-express');

/**
 * @typedef {import('./types').ElasticNodeSDKConfiguration} ElasticNodeSDKConfiguration
 * @typedef {import('./types').Instrumentation} Instrumentation
 */

// Some tests revealed that creating an instance of an instrumentaion
// already register its patch methods before the SDK starts.
// In order to avoid that we need to create our default instrumenations
// in a lazy way so the ones defined by the user have priority over the ones
// in the distro
const INSTRUMENTATIONS = {
    '@opentelemetry/instrumentation-http': () => new HttpInstrumentation(),
    '@opentelemetry/instrumentation-express': () =>
        new ExpressInstrumentation(),
};

/**
 * Get the list of instrumentations baed on options
 * @param {Partial<ElasticNodeSDKConfiguration>} opts
 * @returns {Array<any>}
 */
function getInstrumentations(opts) {
    // User decided to write his/her own list
    // TODO: log if also `instrumentationProviders` is defined???
    if (opts.instrumentations && Array.isArray(opts.instrumentations)) {
        return opts.instrumentations;
    }

    // Provide default instrumentations if no providers present
    if (
        !opts.instrumentationProviders ||
        !Array.isArray(opts.instrumentationProviders)
    ) {
        return Object.values(INSTRUMENTATIONS).map((fn) => fn());
    }

    /** @type {Array<any>} */
    const providers = opts.instrumentationProviders;
    const result = [];
    Object.keys(INSTRUMENTATIONS).forEach((name) => {
        const prov = providers.find((p) => {
            return p.instrumentationName === name || p.for === name;
        });

        let instr;
        if (prov) {
            instr = prov.instrumentationName ? prov : prov.use();
        } else {
            instr = INSTRUMENTATIONS[name]();
        }

        if (instr) {
            result.push(instr);
        }
    });

    return result;
}

module.exports = {
    getInstrumentations,
};
