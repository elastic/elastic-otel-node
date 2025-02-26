/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Sanity test the various ways that ESM support can be enabled.

const test = require('tape');
const {filterOutDnsNetSpans, runTestFixtures} = require('./testutils');

// These ESM tests use the ioredis instrumentation as the guinea pig. That
// unfortunately means we need the Redis test-service running.
const skip = process.env.REDIS_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP esm-usage tests: REDIS_HOST is not set (try with `REDIS_HOST=localhost`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'ESM via --import',
        versionRanges: {
            // TODO: issue on node docs that https://nodejs.org/api/all.html#all_module_moduleregisterspecifier-parenturl-options history doesn't show backport to v18.19.0
            node: '^18.19.0 || >=20.6.0', // when `module.register()` was added
        },
        args: ['./fixtures/use-ioredis.mjs'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            NODE_NO_WARNINGS: '1',
        },
        verbose: true,
        checkTelemetry: function assertUseIoredisMjsSpans(t, col) {
            // Assert that we got the two redis spans expected from 'use-ioredis.mjs'.
            const spans = filterOutDnsNetSpans(col.sortedSpans);
            t.equal(spans[1].name, 'set');
            t.equal(spans[1].attributes['db.system'], 'redis');
            t.equal(spans[2].name, 'get');
        },
    },
];

test('ESM usage', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
