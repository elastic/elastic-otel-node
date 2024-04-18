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

/**
 * Setup and start the OpenTelemetry Node SDK in a way that is close to how
 * Elastic OpenTelemetry Node.js Distro (@elastic/opentelemetry-node) sets it up
 * and starts it.
 *
 * This is to demonstrate that `@elastic/opentelemetry-node` is a small
 * wrapper around the OpenTelemetry Node SDK.
 *
 * Compare:
 *      node -r @elastic/opentelemetry-node simple-http-request.js
 *      node -r ./start-otel-sdk.js                  simple-http-request.js
 *
 * TODO: Refer to elastic otel distro config docs once we have them.
 *
 * Note: By default these will send to the default OTLP endpoint at
 * <http://localhost:4318>. You can start a local mock OTLP server that will
 * print out received telemetry data via:
 *      cd ../packages/mockotlpserver
 *      npm start
 */

const path = require('path');
const {NodeSDK} = require('@opentelemetry/sdk-node');
const {
    getNodeAutoInstrumentations,
} = require('@opentelemetry/auto-instrumentations-node');

const sdk = new NodeSDK({
    serviceName: path.parse(process.argv[1]).name,
    instrumentations: [
        getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': {
                enabled: false,
            },
        }),
    ],
});

process.on('SIGTERM', async () => {
    try {
        await sdk.shutdown();
    } catch (err) {
        console.warn('warning: error shutting down OTel SDK', err);
    }
    process.exit();
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
