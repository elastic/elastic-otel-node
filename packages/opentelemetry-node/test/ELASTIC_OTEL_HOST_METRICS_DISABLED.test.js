/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'basic scenario (ELASTIC_OTEL_HOST_METRICS_DISABLED=true)',
        args: ['./fixtures/use-http-server-metrics.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            // use `console` exporter to inspect stdout for assertions
            OTEL_METRICS_EXPORTER: 'otlp,console',
            ELASTIC_OTEL_HOST_METRICS_DISABLED: 'true',
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

            // metrics from `@opentelemetry/instrumentation-http` exported
            t.ok(hasLog(`name: 'http.client.request.duration'`));
            // metrics from `@opentelemetry/instrumentation-runtime-node` exported
            t.ok(hasLog(`name: 'nodejs.eventloop.utilization'`));
            t.ok(hasLog(`name: 'nodejs.eventloop.delay.min'`));
            t.ok(hasLog(`name: 'nodejs.eventloop.delay.max'`));
            // metrics from `@opentelemetry/host-metrics` shouldn't be exported
            t.ok(!hasLog(`name: 'process.cpu.utilization'`));
        },
        checkTelemetry: (t, col) => {
            t.ok(col.metrics().length > 0);
        },
    },
];

// ----- main line -----

test('ELASTIC_OTEL_METRICS_DISABLED', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
