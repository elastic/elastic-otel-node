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

// Test that 'hapi' instrumentation generates the telemetry we expect.

const test = require('tape');
const {runTestFixtures, findObjInArray} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-hapi',
        args: ['./fixtures/use-hapi.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        versionRanges: {
            node: '>=14.18.0',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this:
            // ------ trace f72866 (3 spans) ------
            //        span b30dea "GET" (7.5ms, SPAN_KIND_CLIENT, GET http://localhost:3000/ping -> 200)
            //   +3ms `- span 2fedbc "GET /ping" (3.4ms, SPAN_KIND_SERVER, GET http://localhost:3000/ping -> 200)
            //   +2ms   `- span a690b0 "route - /ping" (0.1ms, SPAN_KIND_INTERNAL, GET)
            // ------ trace 02f825 (3 spans) ------
            //        span 9a96c1 "GET" (2.0ms, SPAN_KIND_CLIENT, GET http://localhost:3000/hi/Bob -> 200)
            //   +1ms `- span dfacba "GET /hi/{name}" (0.5ms, SPAN_KIND_SERVER, GET http://localhost:3000/hi/Bob -> 200)
            //   +0ms   `- span 71a126 "route - /hi/{name}" (0.0ms, SPAN_KIND_INTERNAL, GET)
            const spans = col.sortedSpans;
            t.equal(spans.length, 6);

            t.equal(spans[0].scope.name, '@opentelemetry/instrumentation-http');
            t.equal(spans[0].name, 'GET');
            t.equal(spans[0].kind, 'SPAN_KIND_CLIENT');

            t.equal(spans[1].name, 'GET /ping');
            t.equal(spans[1].kind, 'SPAN_KIND_SERVER');
            t.equal(spans[1].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[1].parentSpanId, spans[0].spanId);

            t.equal(spans[2].scope.name, '@opentelemetry/instrumentation-hapi');
            t.equal(spans[2].name, 'route - /ping');
            t.equal(spans[2].kind, 'SPAN_KIND_INTERNAL');

            const span = findObjInArray(spans, 'name', 'GET /hi/{name}');
            t.ok(span); // route with param
        },
    },
];

test('hapi instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
