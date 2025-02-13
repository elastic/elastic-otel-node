/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
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
