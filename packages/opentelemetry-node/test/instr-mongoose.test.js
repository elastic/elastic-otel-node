/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that 'mongoose' instrumentation generates the telemetry we expect.

const test = require('tape');
const {filterOutDnsNetSpans, runTestFixtures} = require('./testutils');

let skip = process.env.MONGODB_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP mongodb tests: MONGODB_HOST is not set (try with `MONGODB_HOST=localhost`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-mongoose',
        args: ['./fixtures/use-mongoose.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        versionRanges: {
            node: '>=20.19.0',
        },
        verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            // ------ trace 5527d1 (8 spans) ------
            //        span 91940e "manual-parent-span" (64.5ms, SPAN_KIND_INTERNAL, service.name=unknown_service:node, scope=test)
            //   -2ms `- span fae4d7 "create $cmd" (12.4ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=mongodb)
            //  +14ms `- span 6ba612 "createIndexes users" (2.6ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=mongodb)
            //  -10ms `- span bd95f6 "insert users" (12.4ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=mongodb)
            //  +13ms `- span 8b95c1 "drop $cmd" (1.9ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=mongodb)
            //   +3ms `- span ad6d84 "endSessions $cmd" (0.1ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=mongodb)
            //  -21ms `- span 1ecef1 "save users" (17.8ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=mongoose)
            let spans = filterOutDnsNetSpans(col.sortedSpans);
            // Note: This *sometimes* gets a span named "createIndexes {model}"
            // and sometimes not. To avoid flaky test failures we remove it
            // for testing.
            spans = spans.filter((s) => !s.name.startsWith('createIndexes'));
            t.equal(spans.length, 6);

            t.equal(spans[0].name, 'manual-parent-span');
            t.equal(spans[0].kind, 'SPAN_KIND_INTERNAL');

            const mongooseSpans = spans.filter(
                (s) =>
                    s.scope.name === '@opentelemetry/instrumentation-mongoose'
            );
            t.equal(mongooseSpans.length, 1);

            t.equal(mongooseSpans[0].name, 'save users');
            t.equal(mongooseSpans[0].kind, 'SPAN_KIND_CLIENT');
            t.equal(mongooseSpans[0].parentSpanId, spans[0].spanId);
        },
    },
];

test('mongoose instrumentation', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
