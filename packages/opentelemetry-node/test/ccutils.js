/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Some utilities for central-config tests.

const {subscribe, unsubscribe} = require('diagnostics_channel');
const {
    DIAG_CH_SEND_SUCCESS,
    DIAG_CH_SEND_FAIL,
    DIAG_CH_SEND_SCHEDULE,
} = require('@elastic/opamp-client-node');

/**
 * (Adapted from "opamp-client-node/test/testutils.js".)
 *
 * Wait for `n` OpAMPClient diagnostics channel events, and return them.
 *
 * The OpAMPClient supports a dev/debugging facility where it publishes to
 * well-known diagnostics channels when it schedules and completes messages
 * with the OpAMP server. This allows testing code to properly wait for
 * an internal and async OpAMPClient to do its thing without resorting to
 * flaky sleeps.
 */
function barrierOpAMPClientDiagEvents(n, channels) {
    const chNames = channels || [
        DIAG_CH_SEND_SUCCESS,
        DIAG_CH_SEND_FAIL,
        DIAG_CH_SEND_SCHEDULE,
    ];
    const events = [];
    let barrierResolve;
    const barrier = new Promise((resolve) => {
        barrierResolve = resolve;
    });
    const onEvent = (e) => {
        // console.log('barrierOpAMPClientDiagEvents: onEvent:', e);
        events.push(e);
        if (events.length >= n) {
            // Use `setImmediate` to work around a bug in diagnostics_channel
            // unsubscribing *during* a publish. This was breaking tests with
            // Node.js v18.20.8.
            // https://github.com/nodejs/node/pull/55116
            setImmediate(() => {
                chNames.forEach((ch) => {
                    unsubscribe(ch, onEvent);
                });
                barrierResolve(events);
            });
        }
    };
    chNames.forEach((ch) => {
        subscribe(ch, onEvent);
    });
    return barrier;
}

/**
 * Call the `MockOpAMPServer` API endpoint that allows (when running in
 * testMode) live setting the `agentConfigMap` that is used for remote config
 * in `ServerToAgent` responses.
 */
async function setAgentConfig(config, endpoint) {
    const u = new URL(endpoint || process.env.ELASTIC_OTEL_OPAMP_ENDPOINT);
    u.pathname = '/api/agentConfigMap';
    const res = await fetch(u.href, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(config),
    });
    if (res.status === 204) {
        await res.arrayBuffer(); // https://undici.nodejs.org/#/?id=garbage-collection
    } else {
        const errBody = await res.text();
        throw new Error(
            `failed to set Agent Config on OpAMP server: 'POST ${u.href}' responded: ${res.status}, ${errBody}`
        );
    }
}

module.exports = {
    DIAG_CH_SEND_SUCCESS,
    DIAG_CH_SEND_FAIL,
    DIAG_CH_SEND_SCHEDULE,
    barrierOpAMPClientDiagEvents,
    setAgentConfig,
};
