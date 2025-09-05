/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'scenario with OTEL_LOGS_EXPORTER set to "none"',
        args: ['./fixtures/use-winston.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_LOGS_EXPORTER: 'none',
            // Need to enable log sending to test properly
            ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
        },
        // verbose: true,
        checkResult: (t, err, stdout) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) => lines.some((l) => l.includes(text));

            // Message from upstream SDK
            t.ok(hasLog('Logger provider will not be initialized.'));
        },
        checkTelemetry: (t, col) => {
            t.equal(col.logs.length, 0);
        },
    },
    {
        name: 'scenario with OTEL_LOGS_EXPORTER set to "console"',
        args: ['./fixtures/use-winston.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_LOGS_EXPORTER: 'console',
            // Need to enable log sending to test properly
            ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
        },
        // verbose: true,
        checkResult: (t, err, stdout) => {
            t.error(err);
            const lines = stdout.split('\n');
            const log = lines.find((l) => l.includes('trace_id'));

            t.ok(log);
            t.equal(JSON.parse(log).message, 'with span info');
        },
        checkTelemetry: (t, col) => {
            t.equal(col.logs.length, 0);
        },
    },
    {
        name: 'scenario with OTEL_LOGS_EXPORTER set to bogus value default to "otlp"',
        args: ['./fixtures/use-winston.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_LOGS_EXPORTER: 'bogus',
            // Need to enable log sending to test properly
            ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
        },
        // verbose: true,
        checkResult: (t, err, stdout) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) => lines.some((l) => l.includes(text));

            t.ok(
                hasLog(
                    `Logs exporter \\"bogus\\" unknown. Using default \\"otlp\\" exporter`
                )
            );
        },
        checkTelemetry: (t, col) => {
            t.equal(col.logs.length, 2);
        },
    },
];

// ----- main line -----

test('OTEL_LOGS_EXPORTER', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
