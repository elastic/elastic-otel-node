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

const fs = require('fs');
const http = require('http');
const path = require('path');

const test = require('tape');
const {runTestFixtures} = require('./testutils');

const TEST_REGION = 'us-east-2';

const server = createServer();
const addr = server.address();
// Using the IPv6 address for tests we get the error
// { errno: -3008, code: 'ENOTFOUND', syscall: 'getaddrinfo', hostname: '[::]', '$metadata': { attempts: 1, totalRetryDelay: 0 } }
// so we only use the port in that case
const endpoint = [6, 'IPv6'].includes(addr.family)
    ? `http://localhost:${addr.port}`
    : `http://${addr.address}:${addr.port}`;

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
            TEST_ENDPOINT: endpoint,
            TEST_REGION,
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            //          span b592a3 "manual-parent-span" (26.1ms, SPAN_KIND_INTERNAL)
            //     +4ms `- span bbe07e "S3.ListBuckets" (21.5ms, SPAN_KIND_CLIENT)
            //    +10ms   `- span b3b885 "GET" (7.0ms, SPAN_KIND_CLIENT, GET http://localhost:4566/?x-id=ListBuckets -> 200)
            const spans = col.sortedSpans;
            t.equal(spans.length, 3);

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
    {
        name: 'use-aws-client-sns',
        args: ['./fixtures/use-aws-client-sns.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            AWS_ACCESS_KEY_ID: 'fake',
            AWS_SECRET_ACCESS_KEY: 'fake',
            TEST_ENDPOINT: endpoint,
            TEST_REGION,
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            //          span b592a3 "manual-parent-span" (26.1ms, SPAN_KIND_INTERNAL)
            //     +4ms `- span bbe07e "SNS ListBuckets" (21.5ms, SPAN_KIND_CLIENT)
            //    +10ms   `- span b3b885 "POST" (7.0ms, SPAN_KIND_CLIENT, POST http://localhost:4566/ -> 200)
            const spans = col.sortedSpans;
            t.equal(spans.length, 3);

            t.equal(
                spans[1].scope.name,
                '@opentelemetry/instrumentation-aws-sdk'
            );
            t.equal(spans[1].name, 'SNS ListTopics');
            t.equal(spans[1].kind, 'SPAN_KIND_CLIENT');
            t.equal(spans[1].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[1].parentSpanId, spans[0].spanId);
            t.deepEqual(spans[1].attributes, {
                'rpc.system': 'aws-api',
                'rpc.method': 'ListTopics',
                'rpc.service': 'SNS',
                'messaging.system': 'aws.sns',
                'aws.region': 'us-east-2',
                'http.status_code': 200,
            });
        },
    },
    {
        name: 'use-aws-client-sqs',
        args: ['./fixtures/use-aws-client-sqs.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            AWS_ACCESS_KEY_ID: 'fake',
            AWS_SECRET_ACCESS_KEY: 'fake',
            TEST_ENDPOINT: endpoint,
            TEST_REGION,
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            //          span b592a3 "manual-parent-span" (26.1ms, SPAN_KIND_INTERNAL)
            //     +4ms `- span bbe07e "SQS.ListQueues" (21.5ms, SPAN_KIND_CLIENT)
            //    +10ms   `- span b3b885 "POST" (7.0ms, SPAN_KIND_CLIENT, POST http://localhost:4566/ -> 200)
            const spans = col.sortedSpans;
            t.equal(spans.length, 3);

            t.equal(
                spans[1].scope.name,
                '@opentelemetry/instrumentation-aws-sdk'
            );
            t.equal(spans[1].name, 'SQS.ListQueues');
            t.equal(spans[1].kind, 'SPAN_KIND_CLIENT');
            t.equal(spans[1].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[1].parentSpanId, spans[0].spanId);
            t.deepEqual(spans[1].attributes, {
                'rpc.system': 'aws-api',
                'rpc.method': 'ListQueues',
                'rpc.service': 'SQS',
                'messaging.system': 'aws.sqs',
                'messaging.destination_kind': 'queue',
                'aws.region': 'us-east-2',
                'http.status_code': 200,
            });
        },
    },
    {
        name: 'use-aws-client-dynamodb',
        args: ['./fixtures/use-aws-client-dynamodb.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            AWS_ACCESS_KEY_ID: 'fake',
            AWS_SECRET_ACCESS_KEY: 'fake',
            TEST_ENDPOINT: endpoint,
            TEST_REGION,
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            //          span b592a3 "manual-parent-span" (26.1ms, SPAN_KIND_INTERNAL)
            //     +4ms `- span bbe07e "DynamoDB.ListTables" (21.5ms, SPAN_KIND_CLIENT)
            //    +10ms   `- span b3b885 "POST" (7.0ms, SPAN_KIND_CLIENT, POST http://localhost:4566/ -> 200)
            const spans = col.sortedSpans;
            t.equal(spans.length, 3);

            t.equal(
                spans[1].scope.name,
                '@opentelemetry/instrumentation-aws-sdk'
            );
            t.equal(spans[1].name, 'DynamoDB.ListTables');
            t.equal(spans[1].kind, 'SPAN_KIND_CLIENT');
            t.equal(spans[1].traceId, spans[0].traceId, 'same trace');
            t.equal(spans[1].parentSpanId, spans[0].spanId);
            t.deepEqual(spans[1].attributes, {
                'rpc.system': 'aws-api',
                'rpc.method': 'ListTables',
                'rpc.service': 'DynamoDB',
                'db.system': 'dynamodb',
                'db.operation': 'ListTables',
                'aws.region': 'us-east-2',
                'http.status_code': 200,
                'aws.dynamodb.table_count': 4,
            });
        },
    },
];

// -- helper functions

function createServer() {
    // Set mappings of `METHOD url` for each client. The client is extracted
    // from the `user-agent` header
    const assetsPath = path.resolve(__dirname, './assets');
    const responsePaths = {
        s3: {
            'GET /?x-id=ListBuckets': `${assetsPath}/aws-s3-list-buckets.xml`,
        },
        sns: {
            'POST /': `${assetsPath}/aws-sns-list-topics.xml`,
        },
        sqs: {
            'POST /': `${assetsPath}/aws-sqs-list-queues.json`,
        },
        dynamodb: {
            'POST /': `${assetsPath}/aws-dynamodb-list-tables.json`,
        },
    };
    return http
        .createServer((req, res) => {
            const reqKey = `${req.method} ${req.url}`;
            const agent = req.headers['user-agent'];
            const client = (agent.match(/api\/([^#]+)/) || [])[1];
            const resPath =
                client &&
                responsePaths[client] &&
                responsePaths[client][reqKey];

            if (resPath) {
                const mime = `application/${path.extname(resPath).slice(1)}`;
                res.writeHead(200, {'Content-Type': mime});
                fs.createReadStream(resPath).pipe(res);
                return;
            }

            const message = client
                ? `Handler for "${reqKey}" not found`
                : 'Unknown AWS client';
            const json = `{"error":{"message":"${message}"}}`;
            res.writeHead(404, {'Content-Type': 'application/json'});
            res.write(json);
            res.end();
        })
        .listen();
}

// -- main line
test('express instrumentation', async (suite) => {
    await runTestFixtures(suite, testFixtures);
    server.close();
    suite.end();
});
