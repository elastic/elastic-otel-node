/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that 'aws-sdk' instrumentation generates the telemetry we expect.

const fs = require('fs');
const http = require('http');
const path = require('path');

const test = require('tape');
const {runTestFixtures} = require('./testutils');

const TEST_REGION = 'us-east-2';

const server = createServer();
const endpoint = `http://127.0.0.1:${server.address().port}`;

// `@aws-sdk/client-*` >=3.723.0 switched to `@smithy/smithy-client@4`
// which supports only Node.js v18 and later now.
const AWS_SDK_SUPPORTED_NODE_RANGE = '>=18.0.0';

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-aws-client-s3',
        versionRanges: {node: AWS_SDK_SUPPORTED_NODE_RANGE},
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
            t.equal(spans.length, 2);

            t.equal(
                spans[0].scope.name,
                '@opentelemetry/instrumentation-aws-sdk'
            );
            t.equal(spans[0].name, 'S3.ListBuckets');
            t.equal(spans[0].kind, 'SPAN_KIND_CLIENT');
            t.deepEqual(spans[0].attributes, {
                'rpc.system': 'aws-api',
                'rpc.method': 'ListBuckets',
                'rpc.service': 'S3',
                'cloud.region': 'us-east-2',
                'http.status_code': 200,
            });
        },
    },
    {
        name: 'use-aws-client-sns',
        versionRanges: {node: AWS_SDK_SUPPORTED_NODE_RANGE},
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
            t.equal(spans.length, 2);

            t.equal(
                spans[0].scope.name,
                '@opentelemetry/instrumentation-aws-sdk'
            );
            t.equal(spans[0].name, 'SNS ListTopics');
            t.equal(spans[0].kind, 'SPAN_KIND_CLIENT');
            t.deepEqual(spans[0].attributes, {
                'rpc.system': 'aws-api',
                'rpc.method': 'ListTopics',
                'rpc.service': 'SNS',
                'messaging.system': 'aws.sns',
                'cloud.region': 'us-east-2',
                'http.status_code': 200,
            });
        },
    },
    {
        name: 'use-aws-client-sqs',
        versionRanges: {node: AWS_SDK_SUPPORTED_NODE_RANGE},
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
            t.equal(spans.length, 2);

            t.equal(
                spans[0].scope.name,
                '@opentelemetry/instrumentation-aws-sdk'
            );
            t.equal(spans[0].name, 'SQS.ListQueues');
            t.equal(spans[0].kind, 'SPAN_KIND_CLIENT');
            t.deepEqual(spans[0].attributes, {
                'rpc.system': 'aws-api',
                'rpc.method': 'ListQueues',
                'rpc.service': 'SQS',
                'messaging.system': 'aws.sqs',
                'messaging.destination_kind': 'queue',
                'cloud.region': 'us-east-2',
                'http.status_code': 200,
            });
        },
    },
    {
        name: 'use-aws-client-dynamodb',
        versionRanges: {node: AWS_SDK_SUPPORTED_NODE_RANGE},
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
            t.equal(spans.length, 2);

            t.equal(
                spans[0].scope.name,
                '@opentelemetry/instrumentation-aws-sdk'
            );
            t.equal(spans[0].name, 'DynamoDB.ListTables');
            t.equal(spans[0].kind, 'SPAN_KIND_CLIENT');
            t.deepEqual(spans[0].attributes, {
                'rpc.system': 'aws-api',
                'rpc.method': 'ListTables',
                'rpc.service': 'DynamoDB',
                'db.system': 'dynamodb',
                'db.operation': 'ListTables',
                'cloud.region': 'us-east-2',
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
test('aws-sdk instrumentation', async (suite) => {
    await runTestFixtures(suite, testFixtures);
    server.close();
    suite.end();
});
