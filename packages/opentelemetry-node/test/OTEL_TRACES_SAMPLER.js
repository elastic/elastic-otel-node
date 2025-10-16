/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'OTEL_TRACES_SAMPLER unset (default sampling of 100%)',
        args: ['./fixtures/use-http-get.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
        },
        checkTelemetry: (t, col) => {
            t.equal(col.sortedSpans.length, 1);
        },
    },
    {
        name: 'OTEL_TRACES_SAMPLER unset, OTEL_TRACES_SAMPLER_ARG=0 (no sampling)',
        args: ['./fixtures/use-http-get.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_TRACES_SAMPLER_ARG: '0',
        },
        checkTelemetry: (t, col) => {
            t.equal(col.sortedSpans.length, 0);
        },
    },
    {
        name: 'OTEL_TRACES_SAMPLER=always_off, (no sampling)',
        args: ['./fixtures/use-http-get.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            OTEL_TRACES_SAMPLER: 'always_off',
        },
        checkTelemetry: (t, col) => {
            t.equal(col.sortedSpans.length, 0);
        },
    },
];

// ----- main line -----

test('OTEL_TRACES_SAMPLER', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
