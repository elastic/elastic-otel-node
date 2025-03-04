/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const os = require('os');
const {ElasticNodeSDK} = require('./elastic-node-sdk');

const sdk = new ElasticNodeSDK();

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
