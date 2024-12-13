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
        name: 'basic scenario without values in OTEL_(EN|DIS)ABLED_INSTRUMENTATIONS',
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
        name: 'basic scenario with values only in OTEL_ENABLED_INSTRUMENTATIONS',
        args: ['./fixtures/use-env.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'debug',
            OTEL_NODE_ENABLED_INSTRUMENTATIONS: 'http, express , bogus',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const getLine = (text) => lines.find((l) => l.includes(text));

            t.ok(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-http\\"'
                ),
                'should enable instrumentation passed in env var'
            );
            t.ok(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-express\\"'
                ),
                'should enable instrumentation passed with surroinding spaces in env var'
            );
            t.ok(
                getLine(
                    'Unknown instrumentation \\"@opentelemetry/instrumentation-bogus\\"'
                ),
                'should print a log for the bogus value in enable env var'
            );
            t.notOk(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-fastify\\"'
                ),
                'should not enable instrumentations not in the list'
            );
        },
    },
    {
        name: 'basic scenario with values only in OTEL_DISABLED_INSTRUMENTATIONS',
        args: ['./fixtures/use-env.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'debug',
            OTEL_NODE_DISABLED_INSTRUMENTATIONS: 'fastify, express  , bogus',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const getLine = (text) => lines.find((l) => l.includes(text));

            t.notOk(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-fastify\\"'
                ),
                'should disable instrumentation passed in env var'
            );
            t.notOk(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-express\\"'
                ),
                'should disable instrumentation passed with surroinding spaces in env var'
            );
            t.ok(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-http\\"'
                ),
                'should enable instrumentation not set in the var'
            );
            t.ok(
                getLine(
                    'Unknown instrumentation \\"@opentelemetry/instrumentation-bogus\\"'
                ),
                'should print a log for the bogus value in enable env var'
            );
        },
    },
    {
        name: 'scenario with values in both env vars',
        args: ['./fixtures/use-env.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'debug',
            OTEL_NODE_ENABLED_INSTRUMENTATIONS: 'http, express ,mongodb',
            OTEL_NODE_DISABLED_INSTRUMENTATIONS: 'mongodb, koa',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const getLine = (text) => lines.find((l) => l.includes(text));
            t.ok(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-http\\"'
                ),
                'should enable http instrumentation set in OTEL_NODE_ENABLED_INSTRUMENTATIONS'
            );
            t.ok(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-express\\"'
                ),
                'should enable express instrumentation set in OTEL_NODE_ENABLED_INSTRUMENTATIONS'
            );
            t.notOk(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-mongodb\\"'
                ),
                'mongodb: OTEL_NODE_DISABLED_INSTRUMENTATIONS wins over OTEL_NODE_ENABLED_INSTRUMENTATIONS'
            );
            t.notOk(
                getLine(
                    'Enabling instrumentation \\"@opentelemetry/instrumentation-ioredis\\"'
                ),
                'should not enable instrumentations that are not defined in OTEL_NODE_ENABLED_INSTRUMENTATIONS'
            );
        },
    },
];

test('OTEL_NODE_ENABLED_INSTRUMENTATIONS, OTEL_NODE_DISABLED_INSTRUMENTATIONS', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
