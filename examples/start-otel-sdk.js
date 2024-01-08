/**
 * Setup and start the OpenTelemetry Node SDK in a way that is close to how
 * Elastic OpenTelemetry Node.js Distro (@elastic/opentelemetry-node) sets it up
 * and starts it.
 *
 * This is to demonstrate that `@elastic/opentelemetry-node` is a small
 * wrapper around the OpenTelemetry Node SDK.
 *
 * Compare:
 *      node -r @elastic/opentelemetry-node/start.js simple-http-request.js
 *      node -r ./start-otel-sdk.js                  simple-http-request.js
 *
 * TODO: Refer to elastic otel distro config docs once we have them.
 *
 * Note: By default these will send to the default OTLP endpoint at
 * <http://localhost:4318>. You can start a local mock OTLP server that will
 * print out received telemetry data via:
 *      cd ../packages/mockotlpserver
 *      npm start
 */

const path = require('path');
const {NodeSDK} = require('@opentelemetry/sdk-node');
const {
    getNodeAutoInstrumentations,
} = require('@opentelemetry/auto-instrumentations-node');

const sdk = new NodeSDK({
    serviceName: path.parse(process.argv[1]).name,
    instrumentations: [
        getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': {
                enabled: false,
            },
        }),
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
