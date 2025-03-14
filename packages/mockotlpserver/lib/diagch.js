/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// This file defines the diagnostic channels used by mockotlpserver and
// some utilities for using them.

const diagnostics_channel = require('diagnostics_channel');

// Keep a references to channels created for `ch.subscribe(name)` to avoid
// https://github.com/nodejs/node/issues/42170 bug with Node.js <16.17.0.
/** @type {Record<string, diagnostics_channel.Channel>} */
const diagchFromName = {};

/**
 * Returns the diagnostics channel with the given name
 *
 * @param {string} name
 * @returns {diagnostics_channel.Channel}
 */
function diagchGet(name) {
    if (!(name in diagchFromName)) {
        diagchFromName[name] = diagnostics_channel.channel(name);
    }
    return diagchFromName[name];
}

/**
 * Subscribes a message handler to the diagnostics channel with the given name
 *
 * @param {string} name
 * @param {(msg: any) => void} onMessage
 */
function diagchSub(name, onMessage) {
    if (diagnostics_channel.subscribe) {
        // `diagnostics_channel.subscribe` was added in Node.js 16.17.0.
        diagnostics_channel.subscribe(name, onMessage);
    } else {
        // Keep ref to avoid https://github.com/nodejs/node/issues/42170 bug.
        const ch = diagchGet(name);
        ch.subscribe(onMessage);
    }
}

// A diagnostic channel for each
// `opentelemetry.proto.collector.{signal}.v1.Exports{Signal}ServiceRequest`.
const CH_OTLP_V1_TRACE = 'otlp.v1.trace';
const CH_OTLP_V1_METRICS = 'otlp.v1.metrics';
const CH_OTLP_V1_LOGS = 'otlp.v1.logs';

module.exports = {
    diagchGet,
    diagchSub,

    CH_OTLP_V1_TRACE,
    CH_OTLP_V1_METRICS,
    CH_OTLP_V1_LOGS,
};
