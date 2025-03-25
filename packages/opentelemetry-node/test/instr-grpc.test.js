/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that instrumentation-grpc generates the telemetry we expect.

const test = require('tape');
const {
    filterOutDnsNetSpans,
    runTestFixtures,
    filterOutGcpDetectorSpans,
} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-grpc',
        args: ['./fixtures/use-grpc.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const spans = filterOutGcpDetectorSpans(
                filterOutDnsNetSpans(col.sortedSpans)
            );
            t.equal(spans.length, 2);
            t.equal(spans[0].kind, 'SPAN_KIND_CLIENT');
            t.equal(spans[1].kind, 'SPAN_KIND_SERVER');
            for (let span of spans) {
                t.equal(span.scope.name, '@opentelemetry/instrumentation-grpc');
                t.equal(span.name, 'grpc.helloworld.Greeter/SayHello');
                t.equal(span.attributes['rpc.system'], 'grpc');
                t.equal(span.attributes['rpc.method'], 'SayHello');
                t.equal(span.attributes['rpc.service'], 'helloworld.Greeter');
                t.equal(span.attributes['rpc.grpc.status_code'], 0);
            }
        },
    },
];

test('grpc instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
