/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An example showing the mTLS-related options of OpAMPClient.
 *
 * This expects to talk to an *HTTPS* OpAMP server. For example:
 *      cd packages/mockopampserver
 *      npm run example:mTLS
 *
 * Then run this example client:
 *      cd packages/opamp-client-node
 *      npm run example:mTLS
 */

const fs = require('fs');
const path = require('path');
const luggite = require('luggite');
const {
    createOpAMPClient,
    AgentCapabilities,
    RemoteConfigStatuses,
} = require('..'); // @elastic/opamp-client-node

const log = luggite.createLogger({name: 'use-opamp-client', level: 'trace'});

const TEST_CERTS_DIR = path.resolve(__dirname, '../test/certs');

async function main() {
    const client = createOpAMPClient({
        log,
        endpoint: 'https://localhost:4320/v1/opamp',
        connect: {
            ca: fs.readFileSync(path.join(TEST_CERTS_DIR, 'ca.crt')),
            cert: fs.readFileSync(path.join(TEST_CERTS_DIR, 'client.crt')),
            key: fs.readFileSync(path.join(TEST_CERTS_DIR, 'client.key')),
        },
        capabilities:
            AgentCapabilities.AgentCapabilities_AcceptsRemoteConfig |
            AgentCapabilities.AgentCapabilities_ReportsRemoteConfig,
        onMessage: ({remoteConfig}) => {
            if (remoteConfig) {
                console.log('Got remote config:');
                console.dir(remoteConfig, {depth: 50});

                // Apply the remote config.
                // ...

                // Report the remote config status.
                client.setRemoteConfigStatus({
                    status: RemoteConfigStatuses.RemoteConfigStatuses_APPLIED,
                    lastRemoteConfigHash: remoteConfig.configHash,
                });
            }
        },
    });
    client.setAgentDescription({
        identifyingAttributes: {
            'service.name': 'use-opamp-client',
        },
    });
    client.start();

    setInterval(() => {}, 10000); // Keep running until Ctrl+C.
}

main();
