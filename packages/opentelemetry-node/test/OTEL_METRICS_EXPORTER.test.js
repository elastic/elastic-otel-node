/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'basic scenario with a multiple values (OTEL_METRICS_EXPORTER=otlp,console)',
        args: ['./fixtures/use-http-server-metrics.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_METRICS_EXPORTER: 'otlp,console',
            // The default metrics interval is 30s, which makes for a slow test.
            // However, too low a value runs into possible:
            //      PeriodicExportingMetricReader: metrics collection errors TimeoutError: Operation timed out.
            // which can lead to test data surprises.
            OTEL_METRIC_EXPORT_INTERVAL: '1000',
            OTEL_METRIC_EXPORT_TIMEOUT: '900',
        },
        // verbose: true,
        checkResult: (t, err, stdout) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) => lines.some((l) => l.includes(text));
            // Logs from the console exporter are not JSON parseable
            // so we check presence of some metric names
            t.ok(hasLog(`name: 'http.client.request.duration'`));
            t.ok(hasLog(`name: 'nodejs.eventloop.utilization'`));
            t.ok(hasLog(`name: 'nodejs.eventloop.delay.min'`));
            t.ok(hasLog(`name: 'nodejs.eventloop.delay.max'`));
            t.ok(hasLog(`name: 'process.cpu.utilization'`));
            t.ok(hasLog(`name: 'process.cpu.utilization'`));
            t.ok(hasLog(`name: 'otel.sdk.span.live.count'`));
            t.ok(hasLog(`name: 'otel.sdk.span.closed.count'`));
        },
        checkTelemetry: (t, col) => {
            t.ok(col.metrics.length > 0);
        },
    },
];

// ----- main line -----

test('OTEL_METRICS_EXPORTER', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
