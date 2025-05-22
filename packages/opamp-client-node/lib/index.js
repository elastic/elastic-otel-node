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
const {AgentCapabilities} = require('./generated/opamp_pb');

module.exports = {
    DIAG_CH_SEND_SUCCESS,
    DIAG_CH_SEND_FAIL,
    DIAG_CH_SEND_SCHEDULE,
    USER_AGENT,
    createOpAMPClient,

    // Re-exports of some protobuf classes/enums.
    AgentCapabilities,
};
