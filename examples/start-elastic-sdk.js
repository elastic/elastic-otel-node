/**
 * Setup and start the Elastic OpenTelemetry Node.js SDK distro.
 *
 * This is an alternative to the `node -r @elastic/opentelemetry-node/start.js`
 * convenience for starting the SDK. Starting the SDK manually via a local
 * file can be useful to allow configuring the SDK with code.
 *
 * Usage:
 *      node -r ./start-elastic-sdk.js SCRIPT.js
 */

const path = require('path');

const {ElasticNodeSDK} = require('@elastic/opentelemetry-node');

// TODO: remove BunyanInstrumentation manual usage when the distro includes it by default
const {
    BunyanInstrumentation,
} = require('@opentelemetry/instrumentation-bunyan');
// const {HttpInstrumentation} = require('@opentelemetry/instrumentation-http');
const {
    ExpressInstrumentation,
} = require('@opentelemetry/instrumentation-express');

const sdk = new ElasticNodeSDK({
    serviceName: path.parse(process.argv[1]).name,
    // instrumentations: [
    //     One can **override** completelly the instrumentations provided by ElasticNodeSDK
    //     by specifying `instrumentations`. If this property is set ElasticNodeSDK won't check
    //     for **extensions** if this config in `instrumentationProviders`
    //     new BunyanInstrumentation(),
    // ],
    instrumentationProviders: [
        // One can **override** or **extend** the instrumentations provided by ElasticNodeSDK
        // by specifying `instrumentationProviders`. To **extended** the set of
        // instrumentations provided by ElasticNodeSDK user should add new instrumentations here.
        // To **override** the existing instrumentations there are two options:
        // - passing a new instance of the instrumentation or
        // - passing a object with 2 properties
        //   - `for`: the property of this value must match the `instrumentationName` of the
        //           instance we want to override
        //   - `use`: factory function that must return a new instrumentation object
        // To **remove** an instrumentation use the same object with a function returning `unefined`
        // add Bunyan
        new BunyanInstrumentation(),
        // Modify express
        new ExpressInstrumentation({enabled: false}),
        // Remove http
        {
            // a bit difficult to know all the names, also they're long
            // TODO: aid the dev with types
            for: '@opentelemetry/instrumentation-http',
            use: () => undefined,
        },
    ],
});

process.on('SIGTERM', async () => {
    try {
        await sdk.shutdown();
    } catch (err) {
        console.warn('warning: error shutting down OTel SDK', err);
    }
    process.exit();
});

process.once('beforeExit', async () => {
    // Flush recent telemetry data if about the shutdown.
    try {
        await sdk.shutdown();
    } catch (err) {
        console.warn('warning: error shutting down OTel SDK', err);
    }
});

sdk.start();
