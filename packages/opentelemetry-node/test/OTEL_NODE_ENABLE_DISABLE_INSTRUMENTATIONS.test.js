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

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'basic scenario without values in OTEL_(EN|DIS)ABLE_INSTRUMENTATIONS',
        args: ['./fixtures/use-env.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'debug',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const getLine = (text) => lines.find((l) => l.includes(text));

            // NOTE: checking th 1st and last instrumentation keys of the map to avoid lots of asserts
            t.ok(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-aws-sdk\\"'
                ),
                'should enable aws-sdk instrumentation'
            );
            t.ok(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-winston\\"'
                ),
                'should enable winston instrumentation'
            );
        },
    },
    {
        name: 'scenario with values in OTEL_(EN|DIS)ABLE_INSTRUMENTATIONS',
        args: ['./fixtures/use-env.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'debug',
            OTEL_NODE_ENABLED_INSTRUMENTATIONS:
                'http, express ,mongodb, knex, enable-bogus',
            OTEL_NODE_DISABLED_INSTRUMENTATIONS: 'knex, koa, disable-bogus',
        },
        verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const getLine = (text) => lines.find((l) => l.includes(text));
            t.ok(
                getLine(
                    'Invalid instrumentation \\"@opentelemetry/instrumentation-enable-bogus\\"'
                ),
                'should print a warning for the bogus value in enable env var'
            );
            t.ok(
                getLine(
                    'Invalid instrumentation \\"@opentelemetry/instrumentation-disable-bogus\\"'
                ),
                'should print a warning for the bogus value in enable env var'
            );
            t.ok(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-http\\"'
                ),
                'should enable http instrumentation'
            );
            t.ok(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-express\\"'
                ),
                'should enable express instrumentation'
            );
            t.ok(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-mongodb\\"'
                ),
                'should enable mongodb instrumentation'
            );
            t.notOk(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-knex\\"'
                ),
                'should not enable knex instrumentation'
            );
            t.notOk(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-ioredis\\"'
                ),
                'should not enable instrumentations that are not defined in env vars'
            );
        },
    },
];

test('OTEL_NODE_RESOUCE_DETECTORS', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
