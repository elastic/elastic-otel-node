/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// This script runs through a scenario to test whether the
// `opamp_polling_interval` central config setting (using OpAMP) works.
//
// Expectations:
// - A MockOpAMPServer is running at `ELASTIC_OTEL_OPAMP_ENDPOINT`, in
//   `testMode` (so that it supports `POST /api/agentConfigMap` to change the
//   remote config payload).

const {
    DIAG_CH_SEND_SUCCESS,
    barrierOpAMPClientDiagEvents,
    setElasticConfig,
} = require('../ccutils');

async function main() {
    const keepAlive = setInterval(() => {}, 1000); // keep the Node.js process alive

    // Set remote config on the OpAMP server, then wait for the OpAMP *client*
    // to receive it.
    if (process.env.ELASTIC_OTEL_OPAMP_ENDPOINT) {
        await setElasticConfig({opamp_polling_interval: '400ms'});
        await barrierOpAMPClientDiagEvents(3, [DIAG_CH_SEND_SUCCESS]);
    }

    // Remove the remote config setting. The calling test case will assert
    // that the EDOT SDK logging shows the value was "reset".
    if (process.env.ELASTIC_OTEL_OPAMP_ENDPOINT) {
        await setElasticConfig({});
        await barrierOpAMPClientDiagEvents(3, [DIAG_CH_SEND_SUCCESS]);
    }

    clearInterval(keepAlive);
}

main();
