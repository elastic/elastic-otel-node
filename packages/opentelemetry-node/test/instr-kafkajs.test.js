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
