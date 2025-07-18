/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that `DELTA` is properly set into `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE`
// environment vars if not defined.

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'basic scenario without value in OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE',
        args: ['./fixtures/use-http-server-metrics.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            // The default metrics interval is 30s, which makes for a slow test.
            // However, too low a value runs into possible:
            //      PeriodicExportingMetricReader: metrics collection errors TimeoutError: Operation timed out.
            // which can lead to test data surprises.
            OTEL_METRIC_EXPORT_INTERVAL: '1000',
            OTEL_METRIC_EXPORT_TIMEOUT: '900',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const histogramMetrics = col.metrics().filter((m) => !!m.histogram);

            t.ok(histogramMetrics.length > 0);
            // AGGREGATION_TEMPORALITY_DELTA == 1
            // https://github.com/open-telemetry/opentelemetry-proto/blob/v1.3.2/opentelemetry/proto/metrics/v1/metrics.proto#L289
            t.ok(
                histogramMetrics.every(
                    (m) => m.histogram.aggregationTemporality === 1
                )
            );
        },
    },
    {
        name: 'user set a different value for OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE',
        args: ['./fixtures/use-http-server-metrics.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE: 'cumulative',
            // The default metrics interval is 30s, which makes for a slow test.
            // However, too low a value runs into possible:
            //      PeriodicExportingMetricReader: metrics collection errors TimeoutError: Operation timed out.
            // which can lead to test data surprises.
            OTEL_METRIC_EXPORT_INTERVAL: '1000',
            OTEL_METRIC_EXPORT_TIMEOUT: '900',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const histogramMetrics = col.metrics().filter((m) => !!m.histogram);

            t.ok(histogramMetrics.length > 0);
            t.ok(
                histogramMetrics.every(
                    (m) => m.histogram.aggregationTemporality === 2
                )
            );
        },
    },
];

test('OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
