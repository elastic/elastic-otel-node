/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('tape');
const {filterOutDnsNetSpans, runTestFixtures} = require('./testutils');

const skip = process.env.REDIS_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP ioredis tests: REDIS_HOST is not set (try with `REDIS_HOST=localhost`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-ioredis.js (CommonJS)',
        args: ['./fixtures/use-ioredis.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // Expected a trace like this:
            //     ------ trace 30edbd (6 spans) ------
            //            span 3bfc84 "manual-parent-span" (2.6ms, SPAN_KIND_INTERNAL)
            //       +2ms `- span 804ab9 "set" (12.3ms, SPAN_KIND_CLIENT)
            //       +0ms `- span 3ee842 "get" (11.8ms, SPAN_KIND_CLIENT)
            //      +12ms `- span 525234 "hset" (0.8ms, SPAN_KIND_CLIENT)
            //       +1ms `- span 4711cd "get" (1.1ms, STATUS_CODE_ERROR, SPAN_KIND_CLIENT)
            //       +1ms `- span e00e0f "quit" (0.6ms, SPAN_KIND_CLIENT)
            const spans = filterOutDnsNetSpans(col.sortedSpans);
            t.equal(spans.length, 6);
            spans.slice(1).forEach((s) => {
                t.equal(s.traceId, spans[0].traceId, 'traceId');
                t.equal(s.parentSpanId, spans[0].spanId, 'parentSpanId');
                t.equal(s.kind, 'SPAN_KIND_CLIENT', 'kind');
                t.equal(s.scope.name, '@opentelemetry/instrumentation-ioredis');
                t.equal(s.attributes['db.system'], 'redis');
            });
            t.equal(spans[1].name, 'set');
            t.equal(spans[2].name, 'get');
            t.equal(spans[3].name, 'hset');
            t.equal(spans[4].name, 'get');
            t.equal(spans[4].status.code, 'STATUS_CODE_ERROR');
            t.equal(spans[5].name, 'quit');
        },
    },

    // This duplicates the test case in esm-usage.test.js,
    // but it is useful to have the ESM ioredis sanity test here as well when
    // working on instr-ioredis.
    {
        name: 'use-ioredis.mjs (ESM)',
        versionRanges: {
            node: '^18.19.0 || >=20.6.0', // when `module.register()` was added
        },
        args: ['./fixtures/use-ioredis.mjs'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: assertUseIoredisMjsSpans,
    },
];

function assertUseIoredisMjsSpans(t, col) {
    // Assert that we got the two redis spans expected from 'use-ioredis.mjs'.
    const spans = filterOutDnsNetSpans(col.sortedSpans);
    t.equal(spans[1].name, 'set');
    t.equal(spans[1].attributes['db.system'], 'redis');
    t.equal(spans[2].name, 'get');
}

test('ioredis instrumentation', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
