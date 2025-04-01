/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that 'pino' instrumentation generates the telemetry we expect.

const test = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-pino (default config)',
        args: ['./fixtures/use-pino.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'none',
        },
        versionRanges: {
            // pino@9.3.0 breaks 14.17.0 compat.
            node: '>=14.18.0',
        },
        // verbose: true,
        checkResult: (t, err, stdout, _stderr) => {
            t.error(err, `exited successfully: err=${err}`);
            // Clumsy pass of stdout info to `checkTelemetry`.
            t.recs = stdout.trim().split(/\n/g).map(JSON.parse);
        },
        checkTelemetry: (t, col) => {
            const spans = col.sortedSpans;
            t.equal(spans.length, 1);
            t.equal(t.recs.length, 2);
            // We expect telemetry to *not* have logs by default (see
            // ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING).
            t.equal(col.logs.length, 0);
        },
    },
    {
        name: 'use-pino (ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING=true)',
        args: ['./fixtures/use-pino.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'none',
            ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
        },
        versionRanges: {
            // pino@9.3.0 breaks 14.17.0 compat.
            node: '>=14.18.0',
        },
        // verbose: true,
        checkResult: (t, err, stdout, _stderr) => {
            t.error(err, `exited successfully: err=${err}`);
            // Clumsy pass of stdout info to `checkTelemetry`.
            t.recs = stdout.trim().split(/\n/g).map(JSON.parse);
        },
        checkTelemetry: (t, col) => {
            const recs = t.recs;
            const spans = col.sortedSpans;
            t.equal(spans.length, 1);

            // Check log records to stdout.
            t.equal(recs.length, 2);
            t.equal(recs[0].level, 30 /* pino INFO */);
            t.equal(recs[0].msg, 'hi');
            t.equal(recs[1].level, 30 /* pino INFO */);
            t.equal(recs[1].msg, 'with span info');
            t.equal(recs[1].trace_id, spans[0].traceId);
            t.equal(recs[1].span_id, spans[0].spanId);

            const logs = col.logs;
            t.equal(logs.length, 2);

            t.equal(logs[0].severityText, 'info');
            t.equal(logs[0].body, 'hi');
            t.deepEqual(logs[0].attributes, {foo: 'bar'});
            t.equal(logs[0].scope.name, '@opentelemetry/instrumentation-pino');

            t.equal(logs[1].severityText, 'info');
            t.equal(logs[1].body, 'with span info');
            t.equal(logs[1].traceId, spans[0].traceId);
            t.equal(logs[1].spanId, spans[0].spanId);
        },
    },
];

test('pino instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
