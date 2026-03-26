/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that 'fastify' instrumentation generates the telemetry we expect.

const test = require('tape');
const {
    filterOutDnsNetSpans,
    runTestFixtures,
    findObjInArray,
} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-fastify (with 3rd-party @fastify/otel instrumentation)',
        args: ['./fixtures/use-fastify.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import ./fixtures/telemetry-with-fastify-otel.mjs',
            // Exclude uninteresting 'dns' and 'net' spans.
            OTEL_NODE_DISABLED_INSTRUMENTATIONS: 'dns,net',
        },
        versionRanges: {
            // Ref: https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/#long-term-support-cycle
            node: '>=20.0.0',
        },
        verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            //
            // ------ trace b524ea (4 spans) ------
            //        span eac092 "GET" (9.5ms, SPAN_KIND_CLIENT, GET http://localhost:3000/ping -> 200, scope=http)
            //   +5ms `- span 289989 "GET /ping" (2.6ms, SPAN_KIND_SERVER, GET -> 200, scope=http)
            //   +1ms   `- span 0f16e8 "request" (0.5ms, SPAN_KIND_INTERNAL, GET -> 200, scope=@fastify/otel)
            //   +0ms     `- span 4aec20 "handler - fastify -> @fastify/otel" (0.7ms, SPAN_KIND_INTERNAL, scope=@fastify/otel)
            // ------ trace a3736c (4 spans) ------
            //        span 3a1b8c "GET" (1.1ms, SPAN_KIND_CLIENT, GET http://localhost:3000/hi/Bob -> 200, scope=http)
            //   +1ms `- span 29085f "GET /hi/:name" (0.4ms, SPAN_KIND_SERVER, GET -> 200, scope=http)
            //   +0ms   `- span a519ca "request" (0.1ms, SPAN_KIND_INTERNAL, GET -> 200, scope=@fastify/otel)
            //   +0ms     `- span fe9105 "handler - fastify -> @fastify/otel" (0.1ms, SPAN_KIND_INTERNAL, scope=@fastify/otel)
            const spans = filterOutDnsNetSpans(col.sortedSpans);
            t.equal(spans.length, 8);

            t.equal(spans[0].scope.name, '@opentelemetry/instrumentation-http');
            t.equal(spans[0].name, 'GET');
            t.equal(spans[0].kind, 'SPAN_KIND_CLIENT');

            t.equal(spans[1].name, 'GET /ping');
            t.equal(spans[1].kind, 'SPAN_KIND_SERVER');
            t.equal(spans[1].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[1].parentSpanId, spans[0].spanId);

            t.equal(spans[2].scope.name, '@fastify/otel');
            t.equal(spans[2].name, 'request');
            t.equal(spans[2].kind, 'SPAN_KIND_INTERNAL');

            t.equal(spans[3].scope.name, '@fastify/otel');
            t.equal(spans[3].name, 'handler - fastify -> @fastify/otel');
            t.equal(spans[3].kind, 'SPAN_KIND_INTERNAL');

            const span = findObjInArray(spans, 'name', 'GET /hi/:name');
            t.ok(span); // route with param
        },
    },
];

test('fastify instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
