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
        args: ['./fixtures/use-exporter-protocol.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'verbose',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) =>
                getLogs(lines).some((log) => log.msg.includes(text));
            // Note: `testutils.js` sets the default protocol to 'http/json' via env var OTEL_EXPORTER_OTLP_PROTOCOL
            t.ok(hasLog('Logs exporter protocol set to http/json'));
            t.ok(hasLog('Metrics exporter protocol set to http/json'));
        },
    },
    {
        name: 'scenario with value in OTEL_EXPORTER_OTLP_PROTOCOL',
        args: ['./fixtures/use-exporter-protocol.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'verbose',
            OTEL_EXPORTER_OTLP_PROTOCOL: 'grpc',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) =>
                getLogs(lines).some((log) => log.msg.includes(text));
            t.ok(hasLog('Logs exporter protocol set to grpc'));
            t.ok(hasLog('Metrics exporter protocol set to grpc'));
        },
    },
    {
        name: 'scenario with value in OTEL_EXPORTER_OTLP_LOGS_PROTOCOL',
        args: ['./fixtures/use-exporter-protocol.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'verbose',
            OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: 'grpc',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) =>
                getLogs(lines).some((log) => log.msg.includes(text));
            t.ok(hasLog('Logs exporter protocol set to grpc'));
            // Note: `testutils.js` sets the default protocol to 'http/json' via env var OTEL_EXPORTER_OTLP_PROTOCOL
            t.ok(hasLog('Metrics exporter protocol set to http/json'));
        },
    },
    {
        name: 'scenario with value in OTEL_EXPORTER_OTLP_METRICS_PROTOCOL',
        args: ['./fixtures/use-exporter-protocol.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'verbose',
            OTEL_EXPORTER_OTLP_METRICS_PROTOCOL: 'grpc',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) =>
                getLogs(lines).some((log) => log.msg.includes(text));
            // Note: `testutils.js` sets the default protocol to 'http/json' via env var OTEL_EXPORTER_OTLP_PROTOCOL
            t.ok(hasLog('Logs exporter protocol set to http/json'));
            t.ok(hasLog('Metrics exporter protocol set to grpc'));
        },
    },
    {
        name: 'scenario with bogus value in OTEL_EXPORTER_OTLP_PROTOCOL',
        args: ['./fixtures/use-exporter-protocol.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_EXPORTER_OTLP_PROTOCOL: 'bogus',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) =>
                getLogs(lines).some((log) => log.msg.includes(text));
            t.ok(hasLog('Logs exporter protocol "bogus" unknown.'));
            t.ok(hasLog('Metrics exporter protocol "bogus" unknown.'));
        },
    },
    {
        name: 'scenario with bogus value in OTEL_EXPORTER_OTLP_LOGS_PROTOCOL',
        args: ['./fixtures/use-exporter-protocol.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: 'bogus',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) =>
                getLogs(lines).some((log) => log.msg.includes(text));
            t.ok(hasLog('Logs exporter protocol "bogus" unknown.'));
        },
    },
    {
        name: 'scenario with bogus value in OTEL_EXPORTER_OTLP_METRICS_PROTOCOL',
        args: ['./fixtures/use-exporter-protocol.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_EXPORTER_OTLP_METRICS_PROTOCOL: 'bogus',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const hasLog = (text) =>
                getLogs(lines).some((log) => log.msg.includes(text));
            t.ok(hasLog('Metrics exporter protocol "bogus" unknown.'));
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

test('OTEL_EXPORTER_OTLP_[*]_PROTOCOL', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
