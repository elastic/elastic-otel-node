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
    if (opts.instrumentations && Array.isArray(opts.instrumentations)) {
        return opts.instrumentations;
    }

    if (
        !opts.instrumentationProviders ||
        !Array.isArray(opts.instrumentationProviders)
    ) {
        return Object.values(INSTRUMENTATIONS).map((fn) => fn());
    }

    // TODO: discuss this approach. Use providers to replace current instruentations
    // the shape of a provider is
    // {
    //      for: "name_of_the_instrumentation",
    //      use: () => { new CustomInstrumentation() }
    // }
    // ----
    // also we could pass directly an instrumentation for add/replace
    // PROS:
    // - no need to rewrite all instrumentations
    // - all options are possible (add, remove, replace)
    // - no messing with OTel config types, we're extending
    // CONS:
    // - typos coud lead to unexpected behaviors (double instrumentation)
    // - `instrumentationName` may be not unique???
    // OTHER OPTIONS:
    // - use `instrumentations` and have a `mode` property
    //    - mode extend to add new classes and replace
    //    - mode replace to completelly rewrite instrumentations
    //
    // CRAZY IDEA:
    // have a mode to include only the instrumentations of the detected packages
    // for performance gains
    // - method should be recursive to check all app dependencies
    //    - it would require to scan all instrumentations to extract the modules they patch
    // - or we could have a map per instrumentation name
    //   - eg. 'mongoose' => ['@opentelemetry/instrumentation-mongoose', '@opentelemetry/instrumentation-mongodb']
    // - would require to use a function similar to `safeGetPackageVersion`
    //   - using `module-details-from-path`
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
}

module.exports = {
    getInstrumentations,
};
