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

// Test that instrumentation-graphql generates the telemetry we expect.

const test = require('tape');
const {filterOutDnsNetSpans, runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-graphql',
        args: ['./fixtures/use-graphql.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // // We expect spans like this
            // ------ trace 41f7ac (6 spans) ------
            //        span 49cb5c "manual-parent-span" (17.9ms, SPAN_KIND_INTERNAL)
            //   +3ms `- span 9428d5 "graphql.parse" (1.3ms, SPAN_KIND_INTERNAL)
            //   +2ms `- span 3e6ca5 "graphql.validate" (3.2ms, SPAN_KIND_INTERNAL)
            //   +3ms `- span 7f1bb6 "query" (9.5ms, SPAN_KIND_INTERNAL)
            //   +1ms   `- span 95a0e1 "graphql.resolve todo" (3.8ms, SPAN_KIND_INTERNAL)
            //   +4ms     `- span a4ec19 "graphql.resolve todo.desc" (0.0ms, SPAN_KIND_INTERNAL)
            const spans = col.sortedSpans.slice(1);
            t.equal(spans.length, 5);

            t.ok(spans.every(s => s.scope.name, '@opentelemetry/instrumentation-graphql'))
            t.equal(spans[0].name, 'graphql.parse');
            t.equal(spans[1].name, 'graphql.validate');
            t.equal(spans[2].name, 'query');
            t.equal(spans[3].name, 'graphql.resolve todo');
            t.equal(spans[4].name, 'graphql.resolve todo.desc');
        },
    },
];

test('graphql instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
