/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that `User-Agent` is properly set into `OTEL_EXPORTER_OTLP_*_HEADERS`
// environment vars if not defined.

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'basic scenario without value in OTEL_NODE_RESOURCE_DETECTORS',
        args: ['./fixtures/use-env.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const getLine = (text) => lines.find((l) => l.includes(text));
            t.notOk(
                getLine('Invalid resource detector'),
                'should not print any warning'
            );
        },
    },
    {
        name: 'scenario without values in OTEL_NODE_RESOURCE_DETECTORS',
        args: ['./fixtures/use-env.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_NODE_RESOURCE_DETECTORS: 'gcp, aws, bogus',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const getLine = (text) => lines.find((l) => l.includes(text));
            t.ok(
                getLine('Invalid resource detector \\"bogus\\"'),
                'should print a warning for the bogus value'
            );
            t.notOk(
                getLine('Invalid resource detector \\"gcp\\"'),
                'should not print a warning for GCP detector'
            );
            t.notOk(
                getLine('Invalid resource detector \\"aws\\"'),
                'should not print a warning for AWS detector'
            );
        },
    },
];

test('OTEL_NODE_RESOUCE_DETECTORS', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
