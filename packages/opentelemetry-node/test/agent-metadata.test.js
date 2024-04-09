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

// Test that the metadata is set as expected.
// https://github.com/elastic/opentelemetry-dev/blob/main/docs/specification/agents/otel-distros.md

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

const DISTRO_VERSION = require('../package.json').version;

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'agent metadata default case',
        args: ['./fixtures/use-http-get.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=../start.js',
        },
        checkTelemetry: (t, collector) => {
            const span = collector.sortedSpans[0];
            const attribs = span.resource.attributes;

            // Test OTel SDK add its metadata
            t.equal(attribs['telemetry.sdk.language'], 'nodejs');
            t.equal(attribs['telemetry.sdk.name'], 'opentelemetry');
            t.ok(attribs['telemetry.sdk.version']);
            // Test metadata from the distro
            t.equal(attribs['telemetry.distro.name'], 'elastic');
            t.equal(attribs['telemetry.distro.version'], DISTRO_VERSION);
        },
    },
];

test('agent metadata', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
