/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('tape');
const {
    filterOutDnsNetSpans,
    filterOutGcpDetectorSpans,
    runTestFixtures,
} = require('./testutils');

const skip = process.env.PGHOST === undefined;
if (skip) {
    console.log(
        '# SKIP pg tests: PGHOST is not set (try with `PGHOST=localhost`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-pg',
        args: ['./fixtures/use-pg.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // Expected a trace like this:
            // ------ trace 9169b6 (3 spans) ------
            //        span 102150 "manual-parent-span" (7.5ms, SPAN_KIND_INTERNAL)
            //   +3ms `- span 539d9d "pg.connect" (12.0ms, SPAN_KIND_CLIENT)
            //  +13ms `- span 115c08 "pg.query:SELECT postgres" (2.4ms, SPAN_KIND_CLIENT)
            const spans = filterOutGcpDetectorSpans(
                filterOutDnsNetSpans(col.sortedSpans)
            );
            t.equal(spans.length, 3);
            spans.slice(1).forEach((s) => {
                t.equal(s.traceId, spans[0].traceId, 'traceId');
                t.equal(s.parentSpanId, spans[0].spanId, 'parentSpanId');
                t.equal(s.kind, 'SPAN_KIND_CLIENT', 'kind');
                t.equal(s.scope.name, '@opentelemetry/instrumentation-pg');
                t.equal(s.attributes['db.system'], 'postgresql');
            });
            t.equal(spans[1].name, 'pg.connect');
            t.equal(spans[2].name, 'pg.query:SELECT postgres');
        },
    },
];

test('pg instrumentation', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
