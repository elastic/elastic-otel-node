/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that 'mongodb' instrumentation generates the telemetry we expect.

const test = require('tape');
const {filterOutDnsNetSpans, runTestFixtures} = require('./testutils');

let skip = process.env.MONGODB_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP mongodb tests: MONGODB_HOST is not set (try with `MONGODB_HOST=localhost`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-mongodb',
        args: ['./fixtures/use-mongodb.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        versionRanges: {
            // https://github.com/mongodb/node-mongodb-native/blob/v7.3.0/package.json#L119
            node: '>=20.19.0',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            // ------ trace 0c68f6 (4 spans) ------
            //        span 0971d4 "manual-parent-span" (8.2ms, SPAN_KIND_INTERNAL, service.name=unknown_service:node, scope=test)
            //   +3ms `- span cd2b90 "insert test-col" (1.2ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=mongodb)
            //   +2ms `- span 000a95 "delete test-col" (0.6ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=mongodb)
            //   +2ms `- span 172822 "endSessions $cmd" (0.1ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=mongodb)
            const spans = filterOutDnsNetSpans(col.sortedSpans);
            t.equal(spans.length, 4);

            t.equal(spans[0].name, 'manual-parent-span');
            t.equal(spans[0].kind, 'SPAN_KIND_INTERNAL');

            t.equal(
                spans[1].scope.name,
                '@opentelemetry/instrumentation-mongodb'
            );
            t.equal(spans[1].name, 'insert test-col');
            t.equal(spans[1].kind, 'SPAN_KIND_CLIENT');
            t.equal(spans[1].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[1].parentSpanId, spans[0].spanId);

            t.equal(
                spans[2].scope.name,
                '@opentelemetry/instrumentation-mongodb'
            );
            t.equal(spans[2].name, 'delete test-col');
            t.equal(spans[2].kind, 'SPAN_KIND_CLIENT');
            t.equal(spans[2].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[2].parentSpanId, spans[0].spanId);

            t.equal(
                spans[3].scope.name,
                '@opentelemetry/instrumentation-mongodb'
            );
            t.equal(spans[3].name, 'endSessions $cmd');
            t.equal(spans[3].kind, 'SPAN_KIND_CLIENT');
            t.equal(spans[3].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[3].parentSpanId, spans[0].spanId);
        },
    },
];

test('mongodb instrumentation', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
