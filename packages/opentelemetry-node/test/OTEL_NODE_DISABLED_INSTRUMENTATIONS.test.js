/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'baseline scenario without values in OTEL_(EN|DIS)ABLED_INSTRUMENTATIONS',
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
        name: 'using OTEL_NODE_ENABLED_INSTRUMENTATIONS',
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
                getLine('Unknown instrumentation \\"bogus\\"'),
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
        name: 'using OTEL_NODE_DISABLED_INSTRUMENTATIONS',
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
                getLine('Unknown instrumentation \\"bogus\\"'),
                'should print a log for the bogus value in enable env var'
            );
        },
    },
    {
        name: 'using both OTEL_NODE_ENABLED_INSTRUMENTATIONS and OTEL_NODE_DISABLED_INSTRUMENTATIONS',
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
