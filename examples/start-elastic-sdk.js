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
 * Setup and start the Elastic OpenTelemetry Node.js SDK distro.
 *
 * This is an alternative to the `node -r @elastic/opentelemetry-node`
 * convenience for starting the SDK. Starting the SDK manually via a local
 * file can be useful to allow configuring the SDK with code.
 *
 * Usage:
 *      node -r ./start-elastic-sdk.js SCRIPT.js
 */

const path = require('path');

// TODO see notes for isMainThread and module.register handling

const {
    ElasticNodeSDK,
    getInstrumentations,
} = require('@elastic/opentelemetry-node');

const {
    ExpressInstrumentation,
} = require('@opentelemetry/instrumentation-express');

const sdk = new ElasticNodeSDK({
    serviceName: path.parse(process.argv[1]).name,
    // One can **override** completelly the instrumentations provided by ElasticNodeSDK
    // by specifying `instrumentations`.
    instrumentations: [
        // Users can have the default instrumentations by calling `getInstrumentations`
        // method. The options param is a Record<string, Object | Function> where the key
        // is the name of the instrumentation.
        getInstrumentations({
            // It's possible to pass a configuration object to the instrumentation
            '@opentelemetry/instrumentation-http': {
                serverName: 'test',
            },
            // But also a function could be used to handle more complex scenarios
            '@opentelemetry/instrumentation-express': () => {
                // User can return `undefined` if he/she wants to disable it
                if (process.env.ETEL_DISABLE_EXPRESS) {
                    return undefined;
                }
                // Or return a new instrumentation to replace the default one
                return new ExpressInstrumentation();
            },
        }),
        // Users can apend their own instrumentations as they would do with the vanilla SDK.
        // new AnotherInstrumentation(),
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
