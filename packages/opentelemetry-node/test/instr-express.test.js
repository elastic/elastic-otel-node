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
            // We expect spans like this:
            //   ------ trace 42ec02 (4 spans) ------
            //          span 605836 "GET" (24.0ms, SPAN_KIND_CLIENT, GET http://localhost:54907/ping -> 200)
            //     +6ms `- span abbe5c "GET /ping" (2.7ms, SPAN_KIND_SERVER, GET -> 200)
            //     +0ms   `- span a7d4b1 "request handler - /ping" (1.8ms, SPAN_KIND_INTERNAL)
            //   ------ trace eb7fd8 (3 spans) ------
            //          span e14ef5 "GET" (1.1ms, SPAN_KIND_CLIENT, GET http://localhost:54907/hi/Bob -> 200)
            //     +0ms `- span dae7fc "GET /hi/:name" (0.5ms, SPAN_KIND_SERVER, GET -> 200)
            //     +0ms   `- span 4f437a "request handler - /hi/:name" (0.3ms, SPAN_KIND_INTERNAL)
            const spans = filterOutDnsNetSpans(col.sortedSpans);
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
                '@opentelemetry/instrumentation-express'
            );
            t.equal(spans[2].name, 'request handler - /ping');
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
