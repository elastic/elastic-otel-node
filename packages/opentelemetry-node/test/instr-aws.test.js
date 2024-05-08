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

// Test that 'aws-sdk' instrumentation generates the telemetry we expect.

const test = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-aws-client-s3',
        args: ['./fixtures/use-aws-client-s3.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            AWS_ACCESS_KEY_ID: 'fake',
            AWS_SECRET_ACCESS_KEY: 'fake',
            TEST_LOCAL: 'true',
            TEST_REGION: 'us-east-2',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            //          span b592a3 "manual-parent-span" (26.1ms, SPAN_KIND_INTERNAL)
            //     +4ms `- span bbe07e "S3.ListBuckets" (21.5ms, SPAN_KIND_CLIENT)
            //    +10ms   `- span b3b885 "GET" (7.0ms, SPAN_KIND_CLIENT, GET http://localhost:4566/?x-id=ListBuckets -> 200)
            //     +4ms     `- span 57189f "GET" (2.1ms, SPAN_KIND_SERVER, GET http://localhost:4566/?x-id=ListBuckets -> 200)
            //
            // last span is created when mock server process the request from the AWS sdk
            const spans = col.sortedSpans;
            t.equal(spans.length, 4);

            t.equal(
                spans[1].scope.name,
                '@opentelemetry/instrumentation-aws-sdk'
            );
            t.equal(spans[1].name, 'S3.ListBuckets');
            t.equal(spans[1].kind, 'SPAN_KIND_CLIENT');
            t.equal(spans[1].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[1].parentSpanId, spans[0].spanId);
            t.deepEqual(spans[1].attributes, {
                'rpc.system': 'aws-api',
                'rpc.method': 'ListBuckets',
                'rpc.service': 'S3',
                'aws.region': 'us-east-2',
                'http.status_code': 200,
            });

            // NOTE: should we remove these assertions? aren't they testinh HTTP instr and not AWS?
            t.equal(spans[2].scope.name, '@opentelemetry/instrumentation-http');
            t.equal(spans[2].name, 'GET');
            t.equal(spans[2].kind, 'SPAN_KIND_CLIENT');
            t.equal(spans[2].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[2].parentSpanId, spans[1].spanId);
        },
    },
];

test('express instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
