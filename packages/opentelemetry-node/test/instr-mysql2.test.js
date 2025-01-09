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

// Test that 'mysql' instrumentation generates the telemetry we expect.

const test = require('tape');
const {filterOutDnsNetSpans, runTestFixtures} = require('./testutils');

let skip = process.env.MYSQL_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP mysql2 tests: MYSQL_HOST is not set (try with `MYSQL_HOST=localhost:3306`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-mysql2',
        args: ['./fixtures/use-mysql2.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            // ------ trace 790a66 (4 spans) ------
            //        span bd069a "manual-parent-span" (5.4ms, SPAN_KIND_INTERNAL)
            //  +13ms `- span 1e5ee2 "mongodb.insert" (1.4ms, SPAN_KIND_CLIENT)
            //   +3ms `- span 3d4723 "mongodb.delete" (0.6ms, SPAN_KIND_CLIENT)
            //   +1ms `- span 1c1373 "mongodb.endSessions" (0.3ms, SPAN_KIND_CLIENT)
            const spans = filterOutDnsNetSpans(col.sortedSpans);
            t.equal(spans.length, 4);

            t.equal(spans[0].name, 'manual-parent-span');
            t.equal(spans[0].kind, 'SPAN_KIND_INTERNAL');

            t.equal(
                spans[1].scope.name,
                '@opentelemetry/instrumentation-mysql2'
            );
            t.equal(spans[1].name, 'mongodb.insert');
            t.equal(spans[1].kind, 'SPAN_KIND_CLIENT');
            t.equal(spans[1].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[1].parentSpanId, spans[0].spanId);

            // t.equal(
            //     spans[2].scope.name,
            //     '@opentelemetry/instrumentation-mysql2'
            // );
            // t.equal(spans[2].name, 'mongodb.delete');
            // t.equal(spans[2].kind, 'SPAN_KIND_CLIENT');
            // t.equal(spans[2].traceId, spans[0].traceId, 'same trace');
            // t.equal(spans[2].parentSpanId, spans[0].spanId);
        },
    },
];

test('mysql2 instrumentation', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
