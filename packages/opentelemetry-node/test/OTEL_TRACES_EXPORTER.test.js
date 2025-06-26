/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that the exporters and processors are properly set
// via environment variables. thi test uses an existing fixture
// since we're only interested in startup logs from the distro.

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
        // NOTE: we believe the presence of "none" should disable all exporters
        // (like metrics exporters) but this is not how the upstream SDK works.
        // We keep behavior and will comment in the JS SIG
        name: 'scenario with "none" in the 1st value of OTEL_TRACES_EXPORTER',
        args: ['./fixtures/use-exporter-protocol.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'verbose',
            OTEL_TRACES_EXPORTER: 'none, console, zipkin, otlp',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) =>
                getLogs(lines).some((log) => log.msg.includes(text));
            t.ok(
                hasLog(
                    'OTEL_TRACES_EXPORTER contains "none". No trace information or Spans will be exported.'
                )
            );
            t.ok(!hasLog('Initializing "otlp" traces exporter.'));
            t.ok(!hasLog('Initializing "zipkin" traces exporter.'));
            t.ok(!hasLog('Initializing "jaeger" traces exporter.'));
            t.ok(!hasLog('Initializing "console" traces exporter.'));
        },
    },
    {
        // NOTE: same here. The "none" value has a different effect when not in the
        // 1st position of the list.
        // ref: https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/opentelemetry-sdk-node/src/utils.ts#L144-L162
        name: 'scenario with "none" note in the 1st value of OTEL_TRACES_EXPORTER',
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
            t.ok(
                hasLog(
                    'OTEL_TRACES_EXPORTER contains "none" along with other exporters. Using default otlp exporter.'
                )
            );
            t.ok(hasLog('Initializing "otlp" traces exporter.'));
            t.ok(!hasLog('Initializing "zipkin" traces exporter.'));
            t.ok(!hasLog('Initializing "jaeger" traces exporter.'));
            t.ok(!hasLog('Initializing "console" traces exporter.'));
        },
    },
    {
        name: 'scenario with values in OTEL_TRACES_EXPORTER',
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
