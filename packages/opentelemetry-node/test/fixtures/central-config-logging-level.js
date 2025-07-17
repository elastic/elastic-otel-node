/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// This script runs through a scenario to test whether the `logging_level`
// central config setting (using OpAMP) works.
//
// Expectations:
// - A MockOpAMPServer is running at `ELASTIC_OTEL_OPAMP_ENDPOINT`, in
//   `testMode` (so that it supports `POST /api/agentConfigMap` to change the
//   remote config payload).
// - A MockOTLPServer is running that receives telemetry that can be
//   asserted on.
//
// Usage:
//  ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL=500 \
//      ELASTIC_OTEL_TEST_OPAMP_CLIENT_DIAG_ENABLED=true \
//      ELASTIC_OTEL_OPAMP_ENDPOINT=http://127.0.0.1:4320/v1/opamp \
//      node --import=./import.mjs test/fixtures/exercise-central-config.js

const {
    DIAG_CH_SEND_SUCCESS,
    barrierOpAMPClientDiagEvents,
    setAgentConfig,
} = require('../ccutils');
const {diag} = require('@opentelemetry/api');

async function main() {
    const keepAlive = setInterval(() => {}, 1000); // keep the Node.js process alive

    // 1. Do some OTel/SDK diag logging. Default level is "info", so the
    //    diag.debug should noop.
    diag.verbose('verbose1');
    diag.debug('debug1');
    diag.info('info1');
    diag.warn('warn1');
    diag.error('error1');

    // 2. Call the OpAMP *server* with some agent config. Then wait for the
    //    OpAMP *client* in the OTel SDK instrumenting this script, to receive
    //    that new config. We wait for *three* sends from the OpAMP client to
    //    avoid a race where the client is just sending a heartbeat while
    //   `setAgentConfig` is being called.
    if (process.env.ELASTIC_OTEL_OPAMP_ENDPOINT) {
        setAgentConfig({
            elastic: {body: JSON.stringify({logging_level: 'debug'})},
        });
        await barrierOpAMPClientDiagEvents(3, [DIAG_CH_SEND_SUCCESS]);
    }

    // 3. Now the `diag.debug` should result in an emitted record.
    diag.verbose('verbose2');
    diag.debug('debug2');
    diag.info('info2');
    diag.warn('warn2');
    diag.error('error2');

    // 4. Set central config to empty config, to simulate an Agent Configuration
    //    in Kibana being removed. We expect the EDOT Node.js SDK to reset back
    //    to the default (info) log level.
    if (process.env.ELASTIC_OTEL_OPAMP_ENDPOINT) {
        setAgentConfig({
            elastic: {body: JSON.stringify({})},
        });
        await barrierOpAMPClientDiagEvents(3, [DIAG_CH_SEND_SUCCESS]);
    }

    // 5. Now the `diag.debug` should noop again.
    diag.verbose('verbose3');
    diag.debug('debug3');
    diag.info('info3');
    diag.warn('warn3');
    diag.error('error3');

    clearInterval(keepAlive);
}

main();
