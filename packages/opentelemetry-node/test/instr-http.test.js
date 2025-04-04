/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that 'http' instrumentation generates the telemetry we expect.

const test = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'http.get (stable HTTP semconv if env not set)',
        args: ['./fixtures/use-http-get.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const spans = col.sortedSpans;
            t.equal(spans.length, 1);
            const span = spans[0];
            t.equal(span.scope.name, '@opentelemetry/instrumentation-http');
            t.equal(span.name, 'GET');
            t.equal(span.kind, 'SPAN_KIND_CLIENT');
            t.equal(span.attributes['http.url'], undefined);
            t.equal(span.attributes['url.full'], 'http://www.google.com/');
        },
    },
    {
        name: 'http.get (stable HTTP semconv if env set with other values)',
        args: ['./fixtures/use-http-get.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_SEMCONV_STABILITY_OPT_IN: 'db/dup,foo',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const spans = col.sortedSpans;
            t.equal(spans.length, 1);
            const span = spans[0];
            t.equal(span.scope.name, '@opentelemetry/instrumentation-http');
            t.equal(span.name, 'GET');
            t.equal(span.kind, 'SPAN_KIND_CLIENT');
            t.equal(span.attributes['http.url'], undefined);
            t.equal(span.attributes['url.full'], 'http://www.google.com/');
        },
    },
    {
        name: 'https.get (stable HTTP semconv if env not set)',
        args: ['./fixtures/use-https-get.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const spans = col.sortedSpans;
            t.equal(spans.length, 1);
            const span = spans[0];
            t.equal(span.scope.name, '@opentelemetry/instrumentation-http');
            t.equal(span.name, 'GET');
            t.equal(span.kind, 'SPAN_KIND_CLIENT');
            t.equal(span.attributes['http.url'], undefined);
            t.equal(span.attributes['url.full'], 'https://www.google.com/');
        },
    },
    {
        name: 'http.get (dual HTTP semconv if user set in env)',
        args: ['./fixtures/use-http-get.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_SEMCONV_STABILITY_OPT_IN: 'http/dup',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const spans = col.sortedSpans;
            t.equal(spans.length, 1);
            const span = spans[0];
            t.equal(span.scope.name, '@opentelemetry/instrumentation-http');
            t.equal(span.name, 'GET');
            t.equal(span.kind, 'SPAN_KIND_CLIENT');
            t.equal(span.attributes['http.url'], 'http://www.google.com/');
            t.equal(span.attributes['url.full'], 'http://www.google.com/');
        },
    },
    {
        name: 'https.get (dual HTTP semconv if user set in env)',
        args: ['./fixtures/use-https-get.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_SEMCONV_STABILITY_OPT_IN: 'http/dup',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const spans = col.sortedSpans;
            t.equal(spans.length, 1);
            const span = spans[0];
            t.equal(span.scope.name, '@opentelemetry/instrumentation-http');
            t.equal(span.name, 'GET');
            t.equal(span.kind, 'SPAN_KIND_CLIENT');
            t.equal(span.attributes['http.url'], 'https://www.google.com/');
            t.equal(span.attributes['url.full'], 'https://www.google.com/');
        },
    },
    {
        name: 'http.createServer',
        args: ['./fixtures/use-http-server.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_SEMCONV_STABILITY_OPT_IN: 'http/dup',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // Expect two traces like this:
            //     ------ trace 1e45c8 (2 spans) ------
            //            span 1d3de9 "GET" (20.1ms, STATUS_CODE_ERROR, SPAN_KIND_CLIENT, GET http://127.0.0.1:64972/ -> 404)
            //      +14ms `- span ec9d81 "GET" (3.4ms, SPAN_KIND_SERVER, GET http://127.0.0.1:64972/ -> 404)
            //     ------ trace b8467d (2 spans) ------
            //            span bc8a2c "POST" (3.8ms, SPAN_KIND_CLIENT, POST http://127.0.0.1:64972/echo -> 200)
            //      +2ms `- span 4e7adf "POST" (1.1ms, SPAN_KIND_SERVER, POST http://127.0.0.1:64972/echo -> 200)
            const spans = col.sortedSpans;
            t.equal(spans.length, 4);
            t.equal(spans[0].scope.name, '@opentelemetry/instrumentation-http');
            t.equal(spans[0].name, 'GET');
            t.equal(spans[0].kind, 'SPAN_KIND_CLIENT');
            t.equal(spans[0].status.code, 'STATUS_CODE_ERROR');
            t.equal(spans[0].attributes['http.status_code'], 404);

            t.equal(spans[1].traceId, spans[0].traceId);
            t.equal(spans[1].parentSpanId, spans[0].spanId);
            t.equal(spans[1].name, 'GET');
            t.equal(spans[1].kind, 'SPAN_KIND_SERVER');
            t.equal(spans[1].attributes['http.status_code'], 404);

            t.equal(spans[2].name, 'POST');
            t.equal(spans[2].kind, 'SPAN_KIND_CLIENT');
            t.equal(spans[2].attributes['http.status_code'], 200);

            t.equal(spans[3].traceId, spans[2].traceId);
            t.equal(spans[3].parentSpanId, spans[2].spanId);
            t.equal(spans[3].name, 'POST');
            t.equal(spans[3].kind, 'SPAN_KIND_SERVER');
            t.equal(spans[3].attributes['http.status_code'], 200);
        },
    },
];

test('http instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
