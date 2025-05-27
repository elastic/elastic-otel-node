/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that 'express' instrumentation generates the telemetry we expect.

const test = require('tape');
const {runTestFixtures} = require('./testutils');

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
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_NODE_ENABLED_INSTRUMENTATIONS: 'fs',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            // ------ trace 178891 (1 span) ------
            //        span 8ee183 "fs realpathSync" (0.5ms, SPAN_KIND_INTERNAL)
            // ------ trace 9e0f89 (2 spans) ------
            //        span 3d03e6 "manual-span" (0.7ms, SPAN_KIND_INTERNAL)
            //   +0ms `- span 1dd30d "fs stat" (0.4ms, SPAN_KIND_INTERNAL)
            const spans = col.sortedSpans;
            console.dir(spans, {depth:9})
            t.equal(spans.length, 3);

            t.strictEqual(
                spans.filter(
                    (s) => s.scope.name === '@opentelemetry/instrumentation-fs'
                ).length,
                2
            );
            t.ok(spans.every((s) => s.kind === 'SPAN_KIND_INTERNAL'));
        },
    },
];

test('fs instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
