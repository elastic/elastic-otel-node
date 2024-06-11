/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Test that `User-Agent` is properly set into `OTEL_EXPORTER_OTLP_*_HEADERS`
// environment vars vif not defined.

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
