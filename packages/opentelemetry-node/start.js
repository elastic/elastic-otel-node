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

const os = require('os');
const {ElasticNodeSDK} = require('./lib/sdk.js');

const sdk = new ElasticNodeSDK();

// TODO sdk shutdown: also SIGINT?
// TODO sdk shutdown handlers: better log on err
// TODO sdk shutdown: make these handlers configurable?
//  - If so, could move these into sdk.js and it could use its logger for logging an error.
//  - Note, only want luggite.warn over console.warn if errSerializer gets
//    all attributes (console.warn shows more data for ECONNREFUSED)
// TODO sdk shutdown beforeExit: skip this for Lambda (also Azure Fns?)
// TODO sdh shutdown: call process.exit?
// TODO: Whether we have a signal handler for sdk.shutdown() is debatable. It
// definitely *can* change program behaviour. Let's reconsider.
// Note: See https://github.com/open-telemetry/opentelemetry-js/issues/1521
// for some thoughts on automatic handling to shutdown the SDK.

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
