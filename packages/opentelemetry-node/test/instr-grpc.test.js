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

// Test that instrumentation-grpc generates the telemetry we expect.

const test = require('tape');
const {filterOutDnsNetSpans, runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-grpc',
        args: ['./fixtures/use-grpc.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const spans = filterOutDnsNetSpans(col.sortedSpans);
            t.equal(spans.length, 2);
            t.equal(spans[0].kind, 'SPAN_KIND_CLIENT');
            t.equal(spans[1].kind, 'SPAN_KIND_SERVER');
            for (let span of spans) {
                t.equal(span.scope.name, '@opentelemetry/instrumentation-grpc');
                t.equal(span.name, 'grpc.helloworld.Greeter/SayHello');
                t.equal(span.attributes['rpc.system'], 'grpc');
                t.equal(span.attributes['rpc.method'], 'SayHello');
                t.equal(span.attributes['rpc.service'], 'helloworld.Greeter');
                t.equal(span.attributes['rpc.grpc.status_code'], 0);
            }
        },
    },
];

test('grpc instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
