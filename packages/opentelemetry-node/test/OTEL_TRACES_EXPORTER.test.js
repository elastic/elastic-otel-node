/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'basic scenario with no values in env',
        // Using an existing fixture since we're only interested in startup logs
        // from the distro.
        args: ['./fixtures/use-exporter-protocol.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'verbose',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) =>
                getLogs(lines).some((log) => log.msg.includes(text));
            t.ok(hasLog('Initializing "otlp" traces exporter.'));
            t.ok(!hasLog('Initializing "zipkin" traces exporter.'));
            t.ok(!hasLog('Initializing "jaeger" traces exporter.'));
            t.ok(!hasLog('Initializing "console" traces exporter.'));
        },
    },
    {
        name: 'scenario with "none" in OTEL_TRACES_EXPORTER',
        // Using an existing fixture since we're only interested in startup logs
        // from the distro.
        args: ['./fixtures/use-exporter-protocol.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'verbose',
            OTEL_TRACES_EXPORTER: 'console, zipkin, otlp, none',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) =>
                getLogs(lines).some((log) => log.msg.includes(text));
            t.ok(hasLog('OTEL_TRACES_EXPORTER contains "none". No trace information or Spans will be exported.'));
            t.ok(!hasLog('Initializing "otlp" traces exporter.'));
            t.ok(!hasLog('Initializing "zipkin" traces exporter.'));
            t.ok(!hasLog('Initializing "jaeger" traces exporter.'));
            t.ok(!hasLog('Initializing "console" traces exporter.'));
        },
    },
    {
        name: 'scenario with values in OTEL_TRACES_EXPORTER',
        // Using an existing fixture since we're only interested in startup logs
        // from the distro.
        args: ['./fixtures/use-exporter-protocol.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'verbose',
            OTEL_TRACES_EXPORTER: 'console, otlp',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) =>
                getLogs(lines).some((log) => log.msg.includes(text));
            t.ok(hasLog('Initializing "otlp" traces exporter.'));
            t.ok(hasLog('Initializing "console" traces exporter.'));
            t.ok(!hasLog('Initializing "zipkin" traces exporter.'));
            t.ok(!hasLog('Initializing "jaeger" traces exporter.'));
        },
    },
];

// ----- helper functions -----

/**
 * @param {Array<string>} lines
 * @returns {Array<{name: string, lelvel: number; msg: string}>}
 */
function getLogs(lines) {
    return lines.filter((l) => l.startsWith('{')).map(JSON.parse);
}

// ----- main line -----

test('OTEL_TRACES_EXPORTER', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
