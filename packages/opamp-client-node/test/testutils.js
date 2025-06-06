/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {subscribe, unsubscribe} = require('diagnostics_channel');

const {
    DIAG_CH_SEND_SUCCESS,
    DIAG_CH_SEND_FAIL,
    DIAG_CH_SEND_SCHEDULE,
} = require('..');

function numIsApprox(val, expectedVal, epsilonRatio) {
    const epsilon = expectedVal * epsilonRatio;
    return Math.abs(val - expectedVal) < epsilon;
}

/**
 * Wait for `n` OpAMPClient diagnostics channel events, and return them.
 *
 * These events are published when OpAMPClient is configured with
 * `diagEvents: true`.
 *
 * @param {Number} n
 * @param {string[] | undefined} channels - The diag channel names to wait for.
 *      If undefined, then all channels are waited on.
 * @returns {Promise<any>}
 */
function barrierNDiagEvents(n, channels) {
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
        // console.log('barrierNDiagEvents: onEvent:', e);
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

module.exports = {
    barrierNDiagEvents,
    numIsApprox,
};
