/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that 'express' instrumentation generates the telemetry we expect.

const test = require('tape');
const {
    filterOutDnsNetSpans,
    runTestFixtures,
    findObjInArray,
} = require('./testutils');

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
            // We expect traces like this:
            //
            // ------ trace cc2f1a (6 spans) ------
            //        span 3bd5b8 "GET" (26.4ms, SPAN_KIND_CLIENT, GET http://localhost:59196/ping -> 200, scope=http)
            //   +2ms `- span da9ae3 "tcp.connect" (17.2ms, SPAN_KIND_INTERNAL, scope=net)
            //  +19ms `- span 48f6c1 "GET /ping" (2.6ms, SPAN_KIND_SERVER, GET -> 200, scope=http)
            //   +1ms   `- span f3e387 "middleware - patched" (1.6ms, SPAN_KIND_INTERNAL, scope=router)
            //   +0ms     `- span 231167 "request handler - /ping" (1.4ms, SPAN_KIND_INTERNAL, scope=express)
            //   +1ms       `- span 4aa364 "request handler - /ping" (1.1ms, SPAN_KIND_INTERNAL, scope=router)
            // ------ trace ae73f0 (5 spans) ------
            //        span bbf5b5 "GET" (1.3ms, SPAN_KIND_CLIENT, GET http://localhost:59196/hi/Bob -> 200, scope=http)
            //   +1ms `- span 4afd62 "GET /hi/:name" (0.6ms, SPAN_KIND_SERVER, GET -> 200, scope=http)
            //   +0ms   `- span 433013 "middleware - patched" (0.3ms, SPAN_KIND_INTERNAL, scope=router)
            //   +0ms     `- span e67e8f "request handler - /hi/:name" (0.3ms, SPAN_KIND_INTERNAL, scope=express)
            //   +0ms       `- span 25252e "request handler - /hi/:name" (0.2ms, SPAN_KIND_INTERNAL, scope=router)

            const spans = filterOutDnsNetSpans(col.sortedSpans);
            t.equal(spans.length, 10);

            t.equal(spans[0].scope.name, '@opentelemetry/instrumentation-http');
            t.equal(spans[0].name, 'GET');
            t.equal(spans[0].kind, 'SPAN_KIND_CLIENT');

            t.equal(spans[1].name, 'GET /ping');
            t.equal(spans[1].kind, 'SPAN_KIND_SERVER');
            t.equal(spans[1].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[1].parentSpanId, spans[0].spanId);

            t.equal(
                spans[3].scope.name,
                '@opentelemetry/instrumentation-express'
            );
            t.equal(spans[3].name, 'request handler - /ping');
            t.equal(spans[3].kind, 'SPAN_KIND_INTERNAL');

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
