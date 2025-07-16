/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'basic scenario (ELASTIC_OTEL_METRICS_DISABLED=true)',
        args: ['./fixtures/use-http-server-metrics.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            ELASTIC_OTEL_METRICS_DISABLED: 'true',
            // The default metrics interval is 30s, which makes for a slow test.
            // However, too low a value runs into possible:
            //      PeriodicExportingMetricReader: metrics collection errors TimeoutError: Operation timed out.
            // which can lead to test data surprises.
            OTEL_METRIC_EXPORT_INTERVAL: '1000',
            OTEL_METRIC_EXPORT_TIMEOUT: '900',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            t.ok(col.metrics().length === 0);
        },
    },
];

// ----- main line -----

test('ELASTIC_OTEL_METRICS_DISABLED', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
