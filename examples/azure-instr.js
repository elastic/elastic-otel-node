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

// Setup the Elastic OTel Node.js distro, along with extra Azure instrumentation.
// Usage: node -r ./azure-instr.js SCRIPT.js

const os = require('os');
const path = require('path');

const {
    ElasticNodeSDK,
    getInstrumentations,
} = require('@elastic/opentelemetry-node/sdk');

const {
    createAzureSdkInstrumentation,
} = require('@azure/opentelemetry-instrumentation-azure-sdk');

const sdk = new ElasticNodeSDK({
    serviceName: path.parse(process.argv[1]).name,
    instrumentations: [
        getInstrumentations(), // the default set of instrumentations
        createAzureSdkInstrumentation(),
    ],
});

process.on('SIGTERM', async () => {
    try {
        await sdk.shutdown();
    } catch (err) {
        console.warn('warning: error shutting down OTel SDK', err);
    }
    process.exit(128 + os.constants.signals.SIGTERM);
});

process.once('beforeExit', async () => {
    // Flush recent telemetry data if about the shutdown.
    try {
        await sdk.shutdown();
    } catch (err) {
        console.warn('warning: error shutting down OTel SDK', err);
    }
});

sdk.start();
