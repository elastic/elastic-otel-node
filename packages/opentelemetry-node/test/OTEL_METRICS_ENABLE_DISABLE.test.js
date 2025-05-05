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
        },
        checkTelemetry: (t, col) => {
            t.ok(col.metrics.length > 0);
        },
    },
    {
        name: 'metrics disabled via `none` exporter (OTEL_METRICS_EXPORTER=otlp,console,none)',
        args: ['./fixtures/use-http-server-metrics.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_METRICS_EXPORTER: 'otlp,console,none',
            // The default metrics interval is 30s, which makes for a slow test.
            // However, too low a value runs into possible:
            //      PeriodicExportingMetricReader: metrics collection errors TimeoutError: Operation timed out.
            // which can lead to test data surprises.
            OTEL_METRIC_EXPORT_INTERVAL: '1000',
            OTEL_METRIC_EXPORT_TIMEOUT: '900',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            t.ok(col.metrics.length === 0);
        },
    },
    {
        name: 'metrics disabled via env var (OTEL_METRICS_EXPORTER=otlp,console & ELASTIC_OTEL_METRICS_DISABLED=true)',
        args: ['./fixtures/use-http-server-metrics.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_METRICS_EXPORTER: 'otlp,console',
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
            // console.dir(col.metrics, {depth:9})
            // XXX: this is failing because there are valid exporters set on the config
            // should EDOT set the exporters to "none" if the `ELASTIC_OTEL_METRICS_DISABLED` is true?
            // meaning we completelly disable all metrics from all instrumentations?
            // this differs a bit from the current behavior where it was only disabling runtime ad host
            t.ok(col.metrics.length === 0);
        },
    },
    {
        name: 'runtime and host metrics enabled via `OTEL_NODE_ENABLED_INSTRUMENTATIONS`',
        args: ['./fixtures/use-http-server-metrics.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_METRICS_EXPORTER: 'otlp,console',
            OTEL_NODE_ENABLED_INSTRUMENTATIONS: 'runtime-node,host-metrics',
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

            // metrics from `@opentelemetry/instrumentation-runtime-node` shouldn't be exported
            t.ok(!hasLog(`name: 'nodejs.eventloop.utilization'`));
            t.ok(!hasLog(`name: 'nodejs.eventloop.delay.min'`));
            t.ok(!hasLog(`name: 'nodejs.eventloop.delay.max'`));
            // metrics from `@opentelemetry/host-metrics` shouldn't be exported too
            t.ok(!hasLog(`name: 'process.cpu.utilization'`));
        },
        checkTelemetry: (t, col) => {
            t.ok(col.metrics.length > 0);
        },
    },
    {
        name: 'runtime and host metrics di via `OTEL_NODE_DISABLED_INSTRUMENTATIONS`',
        args: ['./fixtures/use-http-server-metrics.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_METRICS_EXPORTER: 'otlp,console',
            OTEL_NODE_DISABLED_INSTRUMENTATIONS: 'runtime-node,host-metrics',
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

            // metrics from `@opentelemetry/instrumentation-runtime-node`
            t.ok(hasLog(`name: 'nodejs.eventloop.utilization'`));
            t.ok(hasLog(`name: 'nodejs.eventloop.delay.min'`));
            t.ok(hasLog(`name: 'nodejs.eventloop.delay.max'`));
            // metrics from `@opentelemetry/host-metrics`
            t.ok(hasLog(`name: 'process.cpu.utilization'`));
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
