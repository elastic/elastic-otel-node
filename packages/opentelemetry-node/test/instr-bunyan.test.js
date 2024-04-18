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

// Test that 'bunyan' instrumentation generates the telemetry we expect.

const test = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-bunyan',
        args: ['./fixtures/use-bunyan.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect telemetry like this:
            //     ------ logs (2 records) ------
            //     [2024-03-20T23:44:04.857999756Z] info/9 (): hi
            //         name: 'use-bunyan',
            //         foo: 'bar'
            //     [2024-03-20T23:44:04.861000000Z] info/9 (traceId=153156, spanId=9ec413): with span info
            //         name: 'use-bunyan'
            //     ------ trace 153156 (1 span) ------
            //         span 9ec413 "manual-span" (0.8ms, SPAN_KIND_INTERNAL)
            const spans = col.sortedSpans;
            const logs = col.logs;
            t.equal(spans.length, 1);
            t.equal(logs.length, 2);

            t.equal(logs[0].severityText, 'info');
            t.equal(logs[0].body, 'hi');
            t.deepEqual(logs[0].attributes, {name: 'use-bunyan', foo: 'bar'});
            t.equal(
                logs[0].scope.name,
                '@opentelemetry/instrumentation-bunyan'
            );

            t.equal(logs[1].severityText, 'info');
            t.equal(logs[1].body, 'with span info');
            t.equal(logs[1].traceId, spans[0].traceId);
            t.equal(logs[1].spanId, spans[0].spanId);
        },
    },
];

test('bunyan instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
