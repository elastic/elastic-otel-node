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

// Start an HTTP server and make a request to it.
// Usage:
//  node -r @elastic/opentelemetry-node XXX simple-http-request.js

const otel = require('@opentelemetry/api');
const {DefaultAzureCredential} = require('@azure/identity');
const {BlobServiceClient} = require('@azure/storage-blob');

async function main() {
    const account = 'trentmstorage1';
    const defaultAzureCredential = new DefaultAzureCredential();
    const blobServiceClient = new BlobServiceClient(
        `https://${account}.blob.core.windows.net`,
        defaultAzureCredential
    );

    let i = 0;
    for await (const container of blobServiceClient.listContainers()) {
        console.log(`Container ${++i}: ${container.name}`);
    }
    if (i === 0) {
        console.log('Account has no storage blob containers.');
    }

    // // Create a container
    // const containerName = `newcontainer${new Date().getTime()}`;
    // const containerClient = blobServiceClient.getContainerClient(containerName);
    // const createContainerResponse = await containerClient.create();
    // console.log(
    //     `Create container ${containerName} successfully`,
    //     createContainerResponse.requestId
    // );
}

const tracer = otel.trace.getTracer('example');
tracer.startActiveSpan('manual-span', async (span) => {
    await main();
    span.end();
});
