/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Setup and start the OpenTelemetry Node SDK in a way that is close to how
 * Elastic OpenTelemetry Node.js Distro (@elastic/opentelemetry-node) sets it up
 * and starts it.
 *
 * This is to demonstrate that `@elastic/opentelemetry-node` is a small
 * wrapper around the OpenTelemetry Node SDK.
 *
 * Usage:
 *      node -r ./start-otel-sdk.js         simple-http-request.js
 *
 * By default this will send to the default OTLP endpoint: <http://localhost:4318>
 * See the sdk-node configuration docs:
 * https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-sdk-node#configuration
 *
 * Compare to:
 *      node -r @elastic/opentelemetry-node simple-http-request.js
 */

const os = require('os');
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
    process.exit(128 + os.constants.signals.SIGTERM);
});

process.once('beforeExit', async () => {
    // Flush recent telemetry data if about to shutdown.
    try {
        await sdk.shutdown();
    } catch (err) {
        console.warn('warning: error shutting down OTel SDK', err);
    }
});

sdk.start();
