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

// Test that usage of `OTEL_LOG_LEVEL` works as expected.

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'diag default',
        args: ['./fixtures/use-diag.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            t.ok(/hi at info/.test(stdout), 'info');
            t.ok(/hi at warn/.test(stdout), 'warn');
            t.ok(/hi at error/.test(stdout), 'error');
            t.ok(/OTEL_LOG_LEVEL: undefined/.test(stdout), 'envvar');
        },
    },
    {
        name: 'diag OTEL_LOG_LEVEL=debug',
        args: ['./fixtures/use-diag.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'debug',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            t.ok(/hi at debug/.test(stdout), 'debug');
            t.ok(/hi at info/.test(stdout), 'info');
            t.ok(/hi at warn/.test(stdout), 'warn');
            t.ok(/hi at error/.test(stdout), 'error');
            t.ok(/OTEL_LOG_LEVEL: debug/.test(stdout), 'envvar');
        },
    },
    {
        name: 'diag OTEL_LOG_LEVEL=VerBoSe (allow any case)',
        args: ['./fixtures/use-diag.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'VerBoSe',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            t.ok(/hi at verbose/.test(stdout), 'verbose');
            t.ok(/hi at debug/.test(stdout), 'debug');
            t.ok(/hi at info/.test(stdout), 'info');
            t.ok(/hi at warn/.test(stdout), 'warn');
            t.ok(/hi at error/.test(stdout), 'error');
            t.ok(/OTEL_LOG_LEVEL: VerBoSe/.test(stdout), 'envvar');
        },
    },
];

test('OTEL_LOG_LEVEL', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
