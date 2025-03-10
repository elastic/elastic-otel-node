/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-host-metrics.js

const {createHash} = require('crypto');

// Do some work to get some CPU usage for more interesting HostMetrics values.
let lastProgressTime = Date.now();
const workInterval = setInterval(() => {
    const hash = createHash('sha256');
    hash.update(new Array(100).fill(Math.random()).join(','));
    if (Date.now() - lastProgressTime > 500) {
        console.log('.');
        lastProgressTime = Date.now();
    }
}, 10);

// Finish after 1.5x the metrics export interval, to be sure that some
// metrics have been reported for testing.
const exportInterval = process.env.OTEL_METRIC_EXPORT_INTERVAL || 60000;
setTimeout(() => {
    console.log('finishing');
    clearInterval(workInterval);
}, exportInterval * 1.5);
