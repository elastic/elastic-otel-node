/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An example showing how the OpAMPClient could be used.
 */

const luggite = require('luggite');
const {createOpAMPClient, AgentCapabilities} = require('..'); // @elastic/opamp-client-node

const log = luggite.createLogger({name: 'use-opamp-client', level: 'trace'});

async function main() {
    const client = createOpAMPClient({
        log,
        endpoint: 'http://localhost:4315/v1/opamp', // mockopampserver default endpoint
        capabilities:
            AgentCapabilities.AgentCapabilities_AcceptsRemoteConfig |
            AgentCapabilities.AgentCapabilities_ReportsRemoteConfig,
        heartbeatIntervalSeconds: 15,
        onMessage: ({remoteConfig}) => {
            if (remoteConfig) {
                console.log('Got remote config:', remoteConfig);
            }
        },
    });
    client.setAgentDescription({
        identifyingAttributes: {
            'service.name': 'use-opamp-client',
        },
    });
    client.start();

    setInterval(() => {}, 10000); // Keep running.
}

main();
