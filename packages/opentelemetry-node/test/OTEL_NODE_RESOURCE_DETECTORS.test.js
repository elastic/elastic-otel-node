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

// Test that `User-Agent` is properly set into `OTEL_EXPORTER_OTLP_*_HEADERS`
// environment vars vif not defined.

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
                'should not print any warnign'
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
        verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const getLine = (text) => lines.find((l) => l.includes(text));
            t.ok(
                getLine('Invalid resource detector \\"bogus\\"'),
                'should print a warnign for the bogus value'
            );
            t.notOk(
                getLine('Invalid resource detector \\"gcp\\"'),
                'should not print a warnign for GCP detector'
            );
            t.notOk(
                getLine('Invalid resource detector \\"aws\\"'),
                'should not print a warnign for AWS detector'
            );
        },
    },
];

test('OTEL_NODE_RESOUCE_DETECTORS', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
