/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'scenario with OTEL_LOGS_EXPORTER containing "none" value. No logs are sent.',
        args: ['./fixtures/use-winston.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_LOGS_EXPORTER: 'none,oltp',
            // Need to enable log sending to test properly
            ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            t.equal(col.logs.length, 0);
        },
    },
    {
        name: 'scenario with OTEL_LOGS_EXPORTER set to "bogus". No logs are sent.',
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

            t.ok(hasLog(`Logs exporter \\"bogus\\" unknown.`));
        },
        checkTelemetry: (t, col) => {
            t.equal(col.logs.length, 0);
        },
    },
    {
        name: 'scenario with OTEL_LOGS_EXPORTER with multiple values',
        args: ['./fixtures/use-winston.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_LOGS_EXPORTER: 'bogus,console,oltp',
            // Need to enable log sending to test properly
            ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
        },
        // verbose: true,
        checkResult: (t, err, stdout) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) => lines.some((l) => l.includes(text));
            const recordScope = "name: '@opentelemetry/winston-transport'";
            const recordCount = lines.reduce((sum, l) => {
                return l.includes(recordScope) ? sum + 1 : sum;
            }, 0);

            t.ok(hasLog(`Logs exporter \\"bogus\\" unknown.`));
            t.equal(recordCount, 2);
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
