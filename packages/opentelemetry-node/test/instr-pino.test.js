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
        name: 'use-pino',
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

            // TODO: instr-pino doesn't yet support log-sending, so we don't
            // yet expect logs sent via OTLP.
            // const logs = col.logs;
            // ...
        },
    },
];

test('pino instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
