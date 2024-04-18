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

// Test that 'fastify' instrumentation generates the telemetry we expect.

const test = require('tape');
const {runTestFixtures, findObjInArray} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-fastify',
        args: ['./fixtures/use-fastify.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        versionRanges: {
            node: '>=14.18.0',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            // ------ trace 9042af (3 spans) ------
            //         span 5894e1 "GET" (6.8ms, SPAN_KIND_CLIENT, GET http://localhost:3000/ping -> 200)
            //     +3ms `- span c793a1 "GET /ping" (2.7ms, SPAN_KIND_SERVER, GET http://localhost:3000/ping -> 200)
            //     +1ms   `- span f16000 "request handler - fastify" (1.0ms, SPAN_KIND_INTERNAL)
            // ------ trace 8f3ed8 (3 spans) ------
            //         span 6e0fc9 "GET" (1.6ms, SPAN_KIND_CLIENT, GET http://localhost:3000/hi/Bob -> 200)
            //     +1ms `- span 40c4a8 "GET /hi/:name" (0.3ms, SPAN_KIND_SERVER, GET http://localhost:3000/hi/Bob -> 200)
            //     +0ms   `- span 74a68a "request handler - fastify" (0.1ms, SPAN_KIND_INTERNAL)
            const spans = col.sortedSpans;
            t.equal(spans.length, 6);

            t.equal(spans[0].scope.name, '@opentelemetry/instrumentation-http');
            t.equal(spans[0].name, 'GET');
            t.equal(spans[0].kind, 'SPAN_KIND_CLIENT');

            t.equal(spans[1].name, 'GET /ping');
            t.equal(spans[1].kind, 'SPAN_KIND_SERVER');
            t.equal(spans[1].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[1].parentSpanId, spans[0].spanId);

            t.equal(
                spans[2].scope.name,
                '@opentelemetry/instrumentation-fastify'
            );
            t.equal(spans[2].name, 'request handler - fastify');
            t.equal(spans[2].kind, 'SPAN_KIND_INTERNAL');

            const span = findObjInArray(spans, 'name', 'GET /hi/:name');
            t.ok(span); // route with param
        },
    },
];

test('fastify instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
