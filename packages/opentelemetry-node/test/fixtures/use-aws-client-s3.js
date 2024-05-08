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

// Usage: node -r @elastic/opentelemetry-node use-aws-client-s3.js

// This script can also be used for manual testing of APM instrumentation of S3
// against a real S3 account. This can be useful because tests are done against
// a local HTTP server that *simulates* S3 with imperfect fidelity.
//
// Auth note: By default this uses the AWS profile/configuration from the
// environment. If you do not have that configured (i.e. do not have
// "~/.aws/...") files, then you can still use localstack via setting:
//    unset AWS_PROFILE
//    export AWS_ACCESS_KEY_ID=fake
//    export AWS_SECRET_ACCESS_KEY=fake
// See also: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html
//
// Usage:
//    # Run against the default configured AWS profile, listing all available buckets.
//    node use-client-s3.js
//    # Run against a local server which returns a predefined list of buckets.
//    TEST_LOCAL=true node use-client-s3.js

const fs = require('fs');
const http = require('http');
const path = require('path');
const otel = require('@opentelemetry/api');
const {S3Client, ListBucketsCommand} = require('@aws-sdk/client-s3');

const useLocalServer = process.env.TEST_LOCAL === 'true';
const assetsPath = path.resolve(__dirname, '../assets');
/** @type {import('http').Server | undefined} */
let server;

async function main() {
    const localEndpoint = 'http://localhost:4566';
    const region = process.env.TEST_REGION || 'us-east-2';
    const endpoint = useLocalServer ? localEndpoint : null;
    const s3Client = new S3Client({
        region,
        endpoint,
    });

    const command = new ListBucketsCommand({});
    const data = await s3Client.send(command);
    console.log({data}, 'listBuckets');
}

// Start mock server if required
if (useLocalServer) {
    server = http.createServer((req, res) => {
        // GET /?x-id=ListBuckets
        if (req.method === 'GET' && req.url === '/?x-id=ListBuckets') {
            res.writeHead(200, {'Content-Type': 'application/xml'});
            fs.createReadStream(`${assetsPath}/aws-s3-list-buckets.xml`).pipe(
                res
            );
            return;
        }
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.write('Error 404: Not Found.');
        res.end();
    });

    server.listen(4566, 'localhost');
}

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-parent-span', async (span) => {
    await main();
    span.end();
    server?.close();
});
