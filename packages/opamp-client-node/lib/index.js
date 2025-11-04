/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {
    DIAG_CH_SEND_SUCCESS,
    DIAG_CH_SEND_FAIL,
    DIAG_CH_SEND_SCHEDULE,
    USER_AGENT,
    createOpAMPClient,
} = require('./opamp-client');
const {
    AgentCapabilities,
    RemoteConfigStatuses,
} = require('./generated/opamp_pb');

// Re-export some types.
/**
 * @typedef {import('./opamp-client').OpAMPClientOptions} OpAMPClientOptions
 */

module.exports = {
    DIAG_CH_SEND_SUCCESS,
    DIAG_CH_SEND_FAIL,
    DIAG_CH_SEND_SCHEDULE,
    USER_AGENT,
    createOpAMPClient,

    // Re-exports of some protobuf classes/enums as needed for usage.
    AgentCapabilities,
    RemoteConfigStatuses,
};
