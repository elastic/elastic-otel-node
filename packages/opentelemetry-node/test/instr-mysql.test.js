/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that 'mysql' instrumentation generates the telemetry we expect.

const test = require('tape');
const {filterOutDnsNetSpans, runTestFixtures} = require('./testutils');

let skip = process.env.MYSQL_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP mysql tests: MYSQL_HOST is not set (try with `MYSQL_HOST=localhost:3306`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-mysql',
        args: ['./fixtures/use-mysql.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            // ------ trace bc3ada (3 spans) ------
            //        span 8ef53e "manual-parent-span" (21.7ms, SPAN_KIND_INTERNAL)
            //  +1ms `- span 715182 "tcp.connect" (9.4ms, SPAN_KIND_INTERNAL)
            //  +2ms `- span 430253 "SELECT" (18.2ms, SPAN_KIND_CLIENT)
            const spans = filterOutDnsNetSpans(col.sortedSpans);
            t.equal(spans.length, 2);

            t.equal(spans[0].name, 'manual-parent-span');
            t.equal(spans[0].kind, 'SPAN_KIND_INTERNAL');

            t.equal(
                spans[1].scope.name,
                '@opentelemetry/instrumentation-mysql'
            );
            t.equal(spans[1].name, 'SELECT');
            t.equal(spans[1].kind, 'SPAN_KIND_CLIENT');
            t.equal(spans[1].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[1].parentSpanId, spans[0].spanId);
        },
    },
];

test('mysql instrumentation', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
