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

const test = require('tape');
const { filterOutDnsNetSpans, runTestFixtures } = require('./testutils');

// TODO: check https://github.com/elastic/apm-agent-nodejs/blob/main/test/_is_cassandra_incompat.js
const skip = process.env.CASSANDRA_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP cassandra-driver tests: CASSANDRA_HOST is not set (try with `CASSANDRA_HOST=localhost`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-cassandra-driver.js',
        args: ['./fixtures/use-cassandra-driver.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // Expected a trace like this:
            // ------ trace 15ca3e (8 spans) ------
            //        span 3d3aa5 "manual-span" (402.5ms, SPAN_KIND_INTERNAL)
            //  +27ms `- span b8ab8f "tcp.connect" (0.5ms, SPAN_KIND_INTERNAL)
            //  +17ms `- span 6c9179 "tcp.connect" (0.4ms, SPAN_KIND_INTERNAL)
            //  +25ms `- span 97c330 "cassandra-driver.execute" (2.7ms, SPAN_KIND_CLIENT)
            //   +2ms `- span 91e594 "cassandra-driver.execute" (1.6ms, SPAN_KIND_CLIENT)
            //   +2ms `- span 9fbb84 "cassandra-driver.execute" (88.3ms, SPAN_KIND_CLIENT)
            //  +88ms `- span ef48b9 "cassandra-driver.batch" (5.7ms, SPAN_KIND_CLIENT)
            //   +6ms `- span fa5471 "cassandra-driver.execute" (232.5ms, SPAN_KIND_CLIENT)
            const spans = filterOutDnsNetSpans(col.sortedSpans);
            t.equal(spans.length, 6);
            spans.slice(1).forEach((s) => {
                t.equal(s.traceId, spans[0].traceId, 'traceId');
                t.equal(s.parentSpanId, spans[0].spanId, 'parentSpanId');
                t.equal(s.kind, 'SPAN_KIND_CLIENT', 'kind');
                t.equal(s.scope.name, '@opentelemetry/instrumentation-cassandra-driver');
                t.equal(s.attributes['db.system'], 'cassandra');
            });
            t.equal(spans[1].name, 'cassandra-driver.execute');
            t.equal(spans[2].name, 'cassandra-driver.execute');
            t.equal(spans[3].name, 'cassandra-driver.execute');
            t.equal(spans[4].name, 'cassandra-driver.batch');
            t.equal(spans[5].name, 'cassandra-driver.execute');
        },
    },
];

test('cassandra-driver instrumentation', { skip }, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
