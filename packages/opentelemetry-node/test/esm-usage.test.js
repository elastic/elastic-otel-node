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

// Sanity test the various ways that ESM support can be enabled via --require,
// --import, and --experimental-loader (also --loader) in the various versions
// of Node.js

const test = require('tape');
const {runTestFixtures} = require('./testutils');

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
        name: 'ESM via --require',
        versionRanges: {
            // TODO: issue on node docs that https://nodejs.org/api/all.html#all_module_moduleregisterspecifier-parenturl-options history doesn't show backport to v18.19.0
            node: '>=20.6.0 || >=18.19.0', // when `module.register()` was added
        },
        args: ['./fixtures/use-ioredis.mjs'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        verbose: true,
        checkTelemetry: assertUseIoredisMjsSpans,
    },
    {
        name: 'ESM via --import',
        versionRanges: {
            node: '>=20.6.0 || >=18.19.0', // when `module.register()` was added
        },
        args: ['./fixtures/use-ioredis.mjs'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            NODE_NO_WARNINGS: '1',
        },
        verbose: true,
        checkTelemetry: assertUseIoredisMjsSpans,
    },

    // Test the cases where the Node.js version means `--experimental-loader`
    // is needed to register the `import`-hook.
    {
        name: 'ESM via --require & --experimental-loader for older Node.js',
        versionRanges: {
            node: [
                // The minimum versions where `--experimental-loader` works at all.
                '^12.20.0 || ^14.13.1 || ^16.0.0 || ^18.1.0 || >=20.2.0',
                // The Node.js versions before `module.register()` existed.
                '<18.19.0 || >=20.0.0 <20.6.0',
            ],
        },
        args: ['./fixtures/use-ioredis.mjs'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS:
                '--require=@elastic/opentelemetry-node --experimental-loader=@elastic/opentelemetry-node/hook.mjs',
            NODE_NO_WARNINGS: '1',
        },
        verbose: true,
        checkTelemetry: assertUseIoredisMjsSpans,
    },
    {
        name: 'ESM via --import & --experimental-loader for older Node.js',
        versionRanges: {
            node: [
                // The minimum versions where `--experimental-loader` works at all.
                '^12.20.0 || ^14.13.1 || ^16.0.0 || ^18.1.0 || >=20.2.0',
                // The Node.js versions before `module.register()` existed,
                // plus --import was added in v18.18.0.
                '>=18.18.0 <18.19.0 || >=20.0.0 <20.6.0',
            ],
        },
        args: ['./fixtures/use-ioredis.mjs'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS:
                '--import=@elastic/opentelemetry-node --experimental-loader=@elastic/opentelemetry-node/hook.mjs',
            NODE_NO_WARNINGS: '1',
        },
        verbose: true,
        checkTelemetry: assertUseIoredisMjsSpans,
    },

    // Test a couple cases where, with newer Node.js versions that support
    // `module.register()`, we could possibly *double-register* the hook if
    // the user also registered the hook via `--experimental-loader=...`.
    {
        name: 'ESM via --import with possible double-hooking',
        versionRanges: {
            node: '>=20.6.0 || >=18.19.0', // when `module.register()` was added
        },
        args: ['./fixtures/use-ioredis.mjs'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS:
                '--import=@elastic/opentelemetry-node --experimental-loader=@elastic/opentelemetry-node/hook.mjs',
            NODE_NO_WARNINGS: '1',
        },
        verbose: true,
        checkTelemetry: assertUseIoredisMjsSpans,
    },
    {
        name: 'ESM via --require with possible double-hooking',
        versionRanges: {
            node: '>=20.6.0 || >=18.19.0', // when `module.register()` was added
        },
        args: ['./fixtures/use-ioredis.mjs'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS:
                '--require=@elastic/opentelemetry-node --experimental-loader=@elastic/opentelemetry-node/hook.mjs',
            NODE_NO_WARNINGS: '1',
        },
        verbose: true,
        checkTelemetry: assertUseIoredisMjsSpans,
    },
];

function assertUseIoredisMjsSpans(t, col) {
    // Assert that we got the two redis spans expected from 'use-ioredis.mjs'.
    const spans = col.sortedSpans;
    t.equal(spans[1].name, 'set');
    t.equal(spans[1].attributes['db.system'], 'redis');
    t.equal(spans[2].name, 'get');
}

test('ESM usage', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
