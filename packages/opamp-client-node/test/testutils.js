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
 * @returns {Promise<any>}
 */
function barrierNDiagEvents(n) {
    const chNames = [
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
            chNames.forEach((ch) => {
                unsubscribe(ch, onEvent);
            });
            barrierResolve(events);
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
