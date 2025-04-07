/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that 'express' instrumentation generates the telemetry we expect.

const test = require('tape');
const {runTestFixtures, findObjInArray} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-fs (default disabled)',
        args: ['./fixtures/use-fs.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            // ------ trace 6dc0c7 (2 spans) ------
            //        span 3d5f2a "manual-span" (1.2ms, SPAN_KIND_INTERNAL)
            const spans = col.sortedSpans;
            t.equal(spans.length, 1);

            t.equal(spans[0].name, 'manual-span');
            t.equal(spans[0].kind, 'SPAN_KIND_INTERNAL');
        },
    },
    {
        name: 'use-fs (enabled via env var)',
        args: ['./fixtures/use-fs.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_NODE_ENABLED_INSTRUMENTATIONS: 'fs',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect (a) some number of fs spans with no parent:
            //     ------ trace 7c87d0 (1 span) ------
            //          span 1ecc98 "fs statSync" (0.0ms, SPAN_KIND_INTERNAL)
            //     ------ trace 281967 (1 span) ------
            //          span 7bab63 "fs statSync" (0.0ms, SPAN_KIND_INTERNAL)
            //     ...
            // and (b) this:
            //     ------ trace 292114 (2 spans) ------
            //          span c66b96 "manual-span" (6.6ms, SPAN_KIND_INTERNAL)
            //     +1ms `- span 5b7d1c "fs stat" (6.3ms, SPAN_KIND_INTERNAL)
            const spans = col.sortedSpans;

            const manualSpan = findObjInArray(spans, 'name', 'manual-span');
            const childSpan = findObjInArray(
                spans,
                'parentSpanId',
                manualSpan.spanId
            );
            t.ok(childSpan);
            t.strictEqual(childSpan.name, 'fs stat');
            t.strictEqual(
                childSpan.scope.name,
                '@opentelemetry/instrumentation-fs'
            );
        },
    },
];

test('fs instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
