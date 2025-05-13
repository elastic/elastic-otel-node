/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {USER_AGENT, createOpAMPClient} = require('./opamp-client');
const {AgentCapabilities} = require('./generated/opamp_pb');

module.exports = {
    USER_AGENT,
    createOpAMPClient,

    // Re-exports of some protobuf classes/enums.
    AgentCapabilities,
};
