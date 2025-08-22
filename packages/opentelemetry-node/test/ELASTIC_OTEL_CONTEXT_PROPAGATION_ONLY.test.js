/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {test} = require('tape');
const {runTestFixtures, findObjInArray} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'ELASTIC_OTEL_CONTEXT_PROPAGATION_ONLY=true',
        args: ['./fixtures/use-context-propagation-only.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            ELASTIC_OTEL_CONTEXT_PROPAGATION_ONLY: 'true',
            ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
        },
        verbose: true,
        checkTelemetry: (t, col, stdout) => {
            const spans = col.sortedSpans;
            t.equal(spans.length, 0, 'no spans sent via OTLP');

            // OTLP-received logs have traceId/spanId context properties.
            const recs = col.logs;
            const recA = findObjInArray(recs, 'attributes.name', 'serverA');
            const traceId = recA.traceId;
            t.match(
                recA.attributes.headers.traceparent,
                new RegExp(`00-${traceId}-[0-9a-f]{16}-01`)
            );
            const recB = findObjInArray(recs, 'attributes.name', 'serverB');
            t.match(
                recB.attributes.headers.traceparent,
                new RegExp(`00-${traceId}-[0-9a-f]{16}-01`)
            );

            // Logs on stdout include trace_id/span_id.
            const logs = stdout
                .split(/\r?\n/g)
                .filter((ln) => ln.startsWith('{'))
                .map((ln) => JSON.parse(ln));
            const logA = findObjInArray(logs, 'name', 'serverA');
            t.equal(logA.trace_id, traceId);
            t.equal(logA.span_id, recA.spanId);
            const logB = findObjInArray(logs, 'name', 'serverB');
            t.equal(logB.trace_id, traceId);
            t.equal(logB.span_id, recB.spanId);
        },
    },
];

test('ELASTIC_OTEL_CONTEXT_PROPAGATION_ONLY', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
