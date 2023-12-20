// Setup telemetry.
//
// Usage:
//    node -r ./telemetry.js script.js
//
// https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/
// SDK environment variables are supported. Interesting ones might be:
// `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_LOG_LEVEL`.

const path = require('path');
const {NodeSDK} = require('@opentelemetry/sdk-node');
const {
    getNodeAutoInstrumentations,
} = require('@opentelemetry/auto-instrumentations-node');

const sdk = new NodeSDK({
    serviceName: path.parse(process.argv[1]).name || 'mockotlpserver-example',
    instrumentations: [
        getNodeAutoInstrumentations({
            // To reduce noise in the console since we just want
            // http and mongodb spans
            '@opentelemetry/instrumentation-fs': {
                enabled: false,
            },
            '@opentelemetry/instrumentation-connect': {
                enabled: false,
            },
            '@opentelemetry/instrumentation-net': {
                enabled: false,
            },
            '@opentelemetry/instrumentation-dns': {
                enabled: false,
            },
        }),
    ],
});
process.on('SIGTERM', () => {
    sdk.shutdown()
        .then(
            () => {},
            (err) => console.warn('warning: error shutting down OTel SDK', err)
        )
        .finally(() => process.exit(0));
});
process.once('beforeExit', () => {
    // If we are about to exit, shutdown the SDK so recent telemetry data is
    // flushed.
    sdk.shutdown().then(
        () => {},
        (err) => console.warn('warning: error shutting down OTel SDK', err)
    );
});

sdk.start();
