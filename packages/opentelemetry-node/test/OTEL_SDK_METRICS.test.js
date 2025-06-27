/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'basic scenario with no sampling configutarion involved (all spans sampled)',
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
        },
        checkTelemetry: (t, col) => {
            t.ok(col.metrics.length > 0);

            const spanMetrics = col.metrics.filter((m) =>
                m.name.startsWith('otel.sdk.span')
            );
            t.ok(
                spanMetrics.every((m) => {
                    const dataPoints = m.sum.dataPoints;
                    return dataPoints.every(
                        (p) =>
                            p.attributes['otel.span.sampling_result'] ===
                            'RECORD_AND_SAMPLE'
                    );
                })
            );
        },
    },
    {
        name: 'scenario with span sampling configuration involved (not sampling any spans)',
        args: ['./fixtures/use-http-server-metrics.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_METRICS_EXPORTER: 'otlp,console',
            OTEL_TRACES_SAMPLER: 'always_off',
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
        },
        checkTelemetry: (t, col) => {
            t.ok(col.metrics.length > 0);

            const spanMetrics = col.metrics.filter((m) =>
                m.name.startsWith('otel.sdk.span')
            );
            t.equal(spanMetrics.length, 0);
        },
    },
];

// ----- main line -----

test('OTEL_SDK_METRICS', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
