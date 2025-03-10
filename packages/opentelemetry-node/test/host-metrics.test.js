/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that the view set by ElasticNodeSdk work as expected
// - dropping data points for `system.*` metrics
// - exporting data points for `process.*` metrics
// - exporting data points for `nodejs.*` metrics
// - exporting data points for `v8js.*` metrics

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'host metrics default views',
        args: ['./fixtures/use-host-metrics.js'],
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
        checkTelemetry: (t, collector) => {
            const metrics = collector.metrics;
            const systemMetrics = metrics.filter((metric) =>
                metric.name.startsWith('system.')
            );
            const processMetrics = metrics.filter((metric) =>
                metric.name.startsWith('process.')
            );
            const nodejsMetrics = metrics.filter((metric) =>
                metric.name.startsWith('nodejs.')
            );
            const v8jsMetrics = metrics.filter((metric) =>
                metric.name.startsWith('v8js.')
            );

            t.ok(systemMetrics.length === 0, 'system.* metrics are dropped');
            t.ok(processMetrics.length > 0, 'process metrics are collected');
            t.ok(nodejsMetrics.length > 0, 'Node.js metrics are collected');
            t.ok(v8jsMetrics.length > 0, 'V8 metrics are collected');

            // Check that, at least, we send the data which is going to be plotted
            // in Kibana dashboard (mentioned in the docs).
            [
                'process.cpu.utilization',
                'process.memory.usage',
                'nodejs.eventloop.delay.p50',
                'nodejs.eventloop.delay.p90',
                'nodejs.eventloop.delay.max',
                'nodejs.eventloop.utilization',
                // TODO: check for v8js specific ones when adding the to dashboards
            ].forEach((name) => {
                t.ok(
                    metrics.find((m) => m.name === name),
                    `metric "${name}" is collected`
                );
            });
        },
    },
];

test('host metrics', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
