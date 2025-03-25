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
    filterOutGcpDetectorSpans,
} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-fastify (default disabled)',
        args: ['./fixtures/use-fastify.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        versionRanges: {
            // Ref: https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/#long-term-support-cycle
            node: '>=20.0.0',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const spans = filterOutGcpDetectorSpans(filterOutDnsNetSpans(col.sortedSpans));

            t.equal(spans.length, 4);
            t.ok(
                spans.every(
                    (s) =>
                        s.scope.name === '@opentelemetry/instrumentation-http'
                )
            );
            t.ok(spans.every((s) => s.name === 'GET'));
            t.equal(
                spans.filter((s) => s.kind === 'SPAN_KIND_CLIENT').length,
                2
            );
            t.equal(
                spans.filter((s) => s.kind === 'SPAN_KIND_SERVER').length,
                2
            );
        },
    },
    {
        name: 'use-fastify (enabled via env var)',
        args: ['./fixtures/use-fastify.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_NODE_ENABLED_INSTRUMENTATIONS: 'http,fastify',
        },
        versionRanges: {
            // Ref: https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/#long-term-support-cycle
            node: '>=20.0.0',
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
            const spans = filterOutGcpDetectorSpans(filterOutDnsNetSpans(col.sortedSpans));
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
