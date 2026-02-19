/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Testing for these envvars:
//  ELASTIC_OTEL_INSTRUMENTATION_HTTP_CLIENT_CAPTURE_REQUEST_HEADERS
//  ELASTIC_OTEL_INSTRUMENTATION_HTTP_CLIENT_CAPTURE_RESPONSE_HEADERS
//  ELASTIC_OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_REQUEST_HEADERS
//  ELASTIC_OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_RESPONSE_HEADERS

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'headers are captured',
        versionRanges: {
            node: '>=22.3.0', // when `Response.bytes()` was added to bundled undici
        },
        args: ['./fixtures/use-capture-headers.js'],
        cwd: __dirname,
        env: {
            // Options necessary for testing:
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            ELASTIC_OTEL_INSTRUMENTATION_HTTP_CLIENT_CAPTURE_REQUEST_HEADERS:
                'foo,spam,connection,traceparent,twice',
            ELASTIC_OTEL_INSTRUMENTATION_HTTP_CLIENT_CAPTURE_RESPONSE_HEADERS:
                'server,content-type,deuxfois',
            ELASTIC_OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_REQUEST_HEADERS:
                'foo,spam,connection,traceparent,twice',
            ELASTIC_OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_RESPONSE_HEADERS:
                'server,content-type,deuxfois',

            // Options to simplify the SDK work:
            ELASTIC_OTEL_METRICS_DISABLED: 'true',
            // Spans from instr-net and dns can get in the way.
            OTEL_NODE_DISABLED_INSTRUMENTATIONS: 'net,dns',
            // Avoid the HTTP requests from cloud-y resource detectors. This
            // shouldn't be necessary but the added complexity, combined with
            // hooking and/or instr-http bugs can be distracting.
            OTEL_NODE_RESOURCE_DETECTORS: 'env,host,os,process,serviceinstance',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const spans = col.sortedSpans;

            t.comment('span 1: client HTTP span from http.request()')
            let span = spans[0];
            t.deepEqual(span.scope.name, '@opentelemetry/instrumentation-http');
            t.strictEqual(span.kind, 'SPAN_KIND_CLIENT');
            t.deepEqual(span.attributes['http.request.header.foo'], ['Bar']);
            t.deepEqual(span.attributes['http.request.header.traceparent'], [
                `00-${span.traceId}-${span.spanId}-01`,
            ]);
            t.deepEqual(span.attributes['http.response.header.server'], [
                'capture-header-example',
            ]);
            t.deepEqual(span.attributes['http.response.header.content_type'], [
                'text/plain',
            ]);

            t.comment('span 2: server HTTP span')
            span = spans[1];
            t.deepEqual(span.scope.name, '@opentelemetry/instrumentation-http');
            t.strictEqual(span.kind, 'SPAN_KIND_SERVER');
            t.deepEqual(span.attributes['http.request.header.foo'], ['Bar']);
            t.deepEqual(span.attributes['http.request.header.connection'], [
                'keep-alive',
            ]);
            t.deepEqual(span.attributes['http.request.header.traceparent'], [
                `00-${span.traceId}-${span.parentSpanId}-01`,
            ]);
            t.deepEqual(span.attributes['http.response.header.server'], [
                'capture-header-example',
            ]);
            t.deepEqual(span.attributes['http.response.header.content_type'], [
                'text/plain',
            ]);

            t.comment('span 3: client HTTP span from fetch()')
            span = spans[2];
            t.deepEqual(
                span.scope.name,
                '@opentelemetry/instrumentation-undici'
            );
            t.strictEqual(span.kind, 'SPAN_KIND_CLIENT');
            t.deepEqual(span.attributes['http.request.header.spam'], [ 'Eggs' ]);
            t.deepEqual(span.attributes['http.request.header.traceparent'], [ `00-${span.traceId}-${span.spanId}-01` ]);
            // Undici internal representation has joined the two `Twice` header
            // values, so that's what instr-undici returns.
            t.deepEqual(span.attributes['http.request.header.twice'], [ 'A, B' ]);
            t.deepEqual(span.attributes['http.response.header.server'], [ 'capture-header-example' ]);
            // Note: The hyphen in the attr name, not underscore. instr-undici
            // is conforming to stable HTTP semconv here.
            t.deepEqual(span.attributes['http.response.header.content-type'], [ 'text/plain' ]);
            t.deepEqual(span.attributes['http.response.header.deuxfois'], [ 'C', 'D' ]);

            t.comment('span 4: server HTTP span')
            span = spans[3];
            t.deepEqual(span.scope.name, '@opentelemetry/instrumentation-http');
            t.strictEqual(span.kind, 'SPAN_KIND_SERVER');
            t.deepEqual(span.attributes['http.request.header.spam'], ['Eggs']);
            t.deepEqual(span.attributes['http.request.header.connection'], [
                'keep-alive',
            ]);
            t.deepEqual(span.attributes['http.request.header.traceparent'], [
                `00-${span.traceId}-${span.parentSpanId}-01`,
            ]);
            t.deepEqual(span.attributes['http.response.header.server'], [
                'capture-header-example',
            ]);
            t.deepEqual(span.attributes['http.response.header.content_type'], [
                'text/plain',
            ]);
        },
    },
];

// ----- main line -----

test('ELASTIC_OTEL_METRICS_DISABLED', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
