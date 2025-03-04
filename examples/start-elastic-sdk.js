/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Setup and start the Elastic OpenTelemetry Node.js SDK distro.
 *
 * This is an alternative to the typical `node -r @elastic/opentelemetry-node`
 * convenience for starting the SDK. Starting the SDK manually via a local
 * file can be useful to allow configuring the SDK with code.
 *
 * Usage:
 *      node -r ./start-elastic-sdk.js SCRIPT.js
 */

const os = require('os');
const path = require('path');

// TODO see isMainThread and module.register usage in require.js

const {
    ElasticNodeSDK,
    getInstrumentations,
} = require('@elastic/opentelemetry-node/sdk');

const {
    ExpressInstrumentation,
} = require('@opentelemetry/instrumentation-express');

const sdk = new ElasticNodeSDK({
    serviceName: path.parse(process.argv[1]).name,
    // One can **override** completely the instrumentations provided by ElasticNodeSDK
    // by specifying `instrumentations`.
    instrumentations: [
        // Users can have the default instrumentations by calling `getInstrumentations`
        // method. The options param is a Record<string, Object | Function> where the key
        // is the name of the instrumentation.
        getInstrumentations({
            // It's possible to pass a configuration object to the instrumentation
            '@opentelemetry/instrumentation-http': {
                serverName: 'test',
            },
            // But also a function could be used to handle more complex scenarios
            '@opentelemetry/instrumentation-express': () => {
                // User can return `undefined` if he/she wants to disable it
                if (process.env.DISABLE_EXPRESS) {
                    return undefined;
                }
                // Or return a new instrumentation to replace the default one
                return new ExpressInstrumentation();
            },
        }),
        // Users can apend their own instrumentations as they would do with
        // the OTel NodeSDK, for example:
        //  new AnotherInstrumentation(),
    ],
});

process.on('SIGTERM', async () => {
    try {
        await sdk.shutdown();
    } catch (err) {
        console.warn('warning: error shutting down OTel SDK', err);
    }
    process.exit(128 + os.constants.signals.SIGTERM);
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
