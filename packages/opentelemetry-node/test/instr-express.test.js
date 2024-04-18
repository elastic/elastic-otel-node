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

// Test that 'express' instrumentation generates the telemetry we expect.

const test = require('tape');
const {runTestFixtures, findObjInArray} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-express',
        args: ['./fixtures/use-express.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            // ------ trace 6e04fe (5 spans) ------
            //        span 002e07 "GET" (21.5ms, SPAN_KIND_CLIENT, GET http://localhost:56193/ping -> 200)
            //  +13ms `- span 7b0874 "GET /ping" (6.7ms, SPAN_KIND_SERVER, GET http://localhost:56193/ping -> 200)
            //   +2ms   `- span 9ad47c "middleware - query" (0.4ms, SPAN_KIND_INTERNAL)
            //   +1ms   `- span f2c255 "middleware - expressInit" (0.1ms, SPAN_KIND_INTERNAL)
            //   +0ms   `- span 7fd299 "request handler - /ping" (0.0ms, SPAN_KIND_INTERNAL)
            // ------ trace f37cf8 (5 spans) ------
            //        span 1def75 "GET" (3.8ms, SPAN_KIND_CLIENT, GET http://localhost:56193/hi/Bob -> 200)
            //   +2ms `- span 114650 "GET /hi/:name" (1.2ms, SPAN_KIND_SERVER, GET http://localhost:56193/hi/Bob -> 200)
            //   +0ms   `- span 2092ee "middleware - query" (0.1ms, SPAN_KIND_INTERNAL)
            //   +0ms   `- span 033a59 "middleware - expressInit" (0.1ms, SPAN_KIND_INTERNAL)
            //   +1ms   `- span 5573dc "request handler - /hi/:name" (0.0ms, SPAN_KIND_INTERNAL)
            const spans = col.sortedSpans;
            t.equal(spans.length, 10);

            t.equal(spans[0].scope.name, '@opentelemetry/instrumentation-http');
            t.equal(spans[0].name, 'GET');
            t.equal(spans[0].kind, 'SPAN_KIND_CLIENT');

            t.equal(spans[1].name, 'GET /ping');
            t.equal(spans[1].kind, 'SPAN_KIND_SERVER');
            t.equal(spans[1].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[1].parentSpanId, spans[0].spanId);

            t.equal(
                spans[2].scope.name,
                '@opentelemetry/instrumentation-express'
            );
            t.equal(spans[2].name, 'middleware - query');
            t.equal(spans[2].kind, 'SPAN_KIND_INTERNAL');

            // Note: cannot rely on sortedSpans order because the middleware
            // spans are often created in the same millisecond, and
            // span.startTimeUnixNano has millisecond accuracy.
            const span = findObjInArray(spans, 'name', 'GET /hi/:name');
            t.ok(span); // route with param
        },
    },
];

test('express instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
