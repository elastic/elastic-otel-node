/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that 'oracledb' instrumentation generates the telemetry we expect.

const test = require('tape');
const {filterOutDnsNetSpans, runTestFixtures} = require('./testutils');

let skip = process.env.ORACLEDB_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP oracledb tests: ORACLEDB_HOST is not set (try with `ORACLEDB_HOST=localhost:3306`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-oracledb',
        args: ['./fixtures/use-oracledb.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            // ------ trace 76042d (10 spans) ------
            //        span 8bf86e "manual-parent-span" (97.6ms, SPAN_KIND_INTERNAL, service.name=unknown_service:node, scope=test)
            //   +0ms `- span 99cafc "oracledb.getConnection" (92.1ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=oracledb)
            //  +13ms   `- span 2c6cb1 "oracledb.FastAuthMessage" (4.9ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=oracledb)
            //   +5ms   `- span e103ea "oracledb.AuthMessage" (39.9ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=oracledb)
            //  +40ms `- span 45a87b "oracledb.Connection.execute:SELECT FREE|FREEPDB1|freepdb1" (3.7ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=oracledb)
            //   +1ms   `- span 703828 "oracledb.ExecuteMessage:SELECT FREE|FREEPDB1|freepdb1" (2.6ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=oracledb)
            //   +3ms `- span 6d3e53 "oracledb.Connection.close" (1.1ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=oracledb)
            //   +0ms   `- span 43dd41 "oracledb.LogOffMessage" (0.8ms, SPAN_KIND_CLIENT, service.name=unknown_service:node, scope=oracledb)
            const spans = filterOutDnsNetSpans(col.sortedSpans);
            const fistSpan = spans.shift();

            t.equal(spans.length, 7);
            t.equal(fistSpan.name, 'manual-parent-span');
            t.equal(fistSpan.kind, 'SPAN_KIND_INTERNAL');
            t.ok(
                spans.every((s) => {
                    return (
                        s.scope.name ===
                            '@opentelemetry/instrumentation-oracledb' &&
                        s.kind === 'SPAN_KIND_CLIENT' &&
                        s.traceId === fistSpan.traceId
                    );
                })
            );

            // Check some names
            t.equal(spans[0].name, 'oracledb.getConnection');
            t.equal(spans[6].name, 'oracledb.LogOffMessage');
        },
    },
];

test('oracledb instrumentation', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
