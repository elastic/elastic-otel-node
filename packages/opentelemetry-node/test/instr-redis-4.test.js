/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('tape');
const {filterOutDnsNetSpans, runTestFixtures} = require('./testutils');

const skip = process.env.REDIS_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP redis-4 tests: REDIS_HOST is not set (try with `REDIS_HOST=localhost`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-redis.js',
        args: ['./fixtures/use-redis.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // Expected a trace like this:
            // ------ trace 8c7cf8 (7 spans) ------
            //         span 97045e "manual-parent-span" (16.1ms, SPAN_KIND_INTERNAL)
            // +0ms `- span 2e894a "redis-connect" (5.3ms, SPAN_KIND_CLIENT)
            // +5ms `- span 00fed3 "redis-SET" (1.4ms, SPAN_KIND_CLIENT)
            // +2ms `- span 8aa27e "redis-GET" (0.7ms, SPAN_KIND_CLIENT)
            // +1ms `- span e9d2b9 "redis-HSET" (0.9ms, SPAN_KIND_CLIENT)
            // +0ms `- span 0a31fa "redis-GET" (0.8ms, STATUS_CODE_ERROR, SPAN_KIND_CLIENT)
            const spans = filterOutDnsNetSpans(col.sortedSpans);
            t.equal(spans.length, 6);
            spans.slice(1).forEach((s) => {
                t.equal(s.traceId, spans[0].traceId, 'traceId');
                t.equal(s.parentSpanId, spans[0].spanId, 'parentSpanId');
                t.equal(s.kind, 'SPAN_KIND_CLIENT', 'kind');
                t.equal(s.scope.name, '@opentelemetry/instrumentation-redis-4');
                t.equal(s.attributes['db.system'], 'redis');
            });
            t.equal(spans[1].name, 'redis-connect');
            t.equal(spans[2].name, 'redis-SET');
            t.equal(spans[3].name, 'redis-GET');
            t.equal(spans[4].name, 'redis-HSET');
            t.equal(spans[5].name, 'redis-GET');
            t.equal(spans[5].status.code, 'STATUS_CODE_ERROR');
        },
    },
    // ESM redis sanity test
    {
        name: 'use-redis.mjs (ESM)',
        versionRanges: {
            node: '^18.19.0 || >=20.6.0', // when `module.register()` was added
        },
        args: ['./fixtures/use-redis.mjs'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
        },
        verbose: true,
        checkTelemetry: (t, col) => {
            // Assert that we got the three redis spans expected from 'use-redis.mjs'.
            const spans = filterOutDnsNetSpans(col.sortedSpans);
            t.equal(spans[1].name, 'redis-connect');
            t.equal(spans[1].attributes['db.system'], 'redis');
            t.equal(spans[2].name, 'redis-SET');
            t.equal(spans[3].name, 'redis-GET');
        },
    },
];

test('redis-4 instrumentation', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
