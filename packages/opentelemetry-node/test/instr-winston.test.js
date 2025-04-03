/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that 'winston' instrumentation generates the telemetry we expect.

const test = require('tape');
const {runTestFixtures} = require('./testutils');

let recs; // somewhat clumsy passing from checkResult to checkTelemetry

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-winston (default config)',
        args: ['./fixtures/use-winston.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'none',
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
        name: 'use-winston (ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING=true)',
        args: ['./fixtures/use-winston.js'],
        cwd: __dirname,
        env: {
            OTEL_LOG_LEVEL: 'none',
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
        },
        // verbose: true,
        checkResult: (t, err, stdout, _stderr) => {
            t.error(err, `exited successfully: err=${err}`);
            recs = stdout.trim().split(/\n/g).map(JSON.parse);
        },
        checkTelemetry: (t, col) => {
            const spans = col.sortedSpans;
            t.equal(spans.length, 1);

            // Check log records to stdout.
            t.equal(recs.length, 2);
            t.equal(recs[0].level, 'info');
            t.equal(recs[0].message, 'hi');
            t.equal(recs[1].level, 'info');
            t.equal(recs[1].message, 'with span info');
            t.equal(recs[1].trace_id, spans[0].traceId);
            t.equal(recs[1].span_id, spans[0].spanId);

            const logs = col.logs;
            t.equal(logs.length, 2);
            t.equal(logs[0].severityText, 'info');
            t.equal(logs[0].body, 'hi');
            t.deepEqual(logs[0].attributes, {foo: 'bar'});
            t.equal(logs[0].scope.name, '@opentelemetry/winston-transport');
            t.equal(logs[1].severityText, 'info');
            t.equal(logs[1].body, 'with span info');
            // TODO: test these after https://github.com/open-telemetry/opentelemetry-js-contrib/issues/2010 is resolved
            // t.equal(logs[1].traceId, spans[0].traceId);
            // t.equal(logs[1].spanId, spans[0].spanId);
        },
    },
];

test('winston instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
