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

const sdk = new ElasticNodeSDK({
    serviceName: path.parse(process.argv[1]).name,
    instrumentations: [
        // One can **override** the instrumentations provided by ElasticNodeSDK
        // by specifying `instrumentations`. How to **extended** the set of
        // instrumentations provided by ElasticNodeSDK is to be determined (TODO).
        new BunyanInstrumentation(),
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
