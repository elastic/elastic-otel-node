/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that instrumentation-kafkajs generates the telemetry we expect.

const test = require('tape');
const {runTestFixtures, filterOutDnsNetSpans} = require('./testutils');

let skip = process.env.KAFKA_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP kafkajs tests: KAFKA_HOST is not set (try with `KAFKA_HOST=localhost`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-kafkajs',
        args: ['./fixtures/use-kafkajs.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            TEST_KAFKAJS_TOPIC: 'edot-test-topic',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            // ------ trace 916148 (7 spans) ------
            //        span 199d7e "manual-parent-span" (3.4ms, SPAN_KIND_INTERNAL)
            //   -3ms `- span 2da778 "edot-test-topic" (19.6ms, SPAN_KIND_PRODUCER)
            //   +1ms `- span 6d088b "edot-test-topic" (19.4ms, SPAN_KIND_PRODUCER)
            const spans = filterOutDnsNetSpans(col.sortedSpans.slice(1));
            t.equal(spans.length, 2);

            t.ok(
                spans.every(
                    (s) => s.scope.name,
                    '@opentelemetry/instrumentation-kafkajs'
                )
            );
            t.ok(spans.every((s) => s.name, 'edot-test-topic'));
            t.ok(spans.every((s) => s.kind, 'SPAN_KIND_PRODUCER'));
        },
    },
];

test('kafkajs instrumentation', {skip}, async (suite) => {
    await runTestFixtures(suite, testFixtures);
    suite.end();
});
