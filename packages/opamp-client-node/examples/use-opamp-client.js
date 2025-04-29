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
        onMessage: ({remoteConfig}) => {
            if (remoteConfig) {
                console.log('Got remote config:', remoteConfig);
                // TODO: should report remote config status
            }
        },
    });
    client.setAgentDescription({
        identifyingAttributes: {
            'service.name': 'use-opamp-client',
        },
        // nonIdentifyingAttributes: {
        //     // TODO: use these to a test case
        //     aStr: 'strVal',
        //     aBool: true,
        //     aBool2: false,
        //     anInt: 42,
        //     aFloat: 3.141,
        //     aBigInt: 1152921504606846976n, // less than 2**64, bigger than MAX_SAFE_INTEGER
        //     aUint8Array: new Uint8Array([1, 2, 3]),
        //     anArray: [1, 2, 3, 'a', 'b', 'c', {spam: 'eggs'}],
        //     anObj: {foo: 'bar', baz: 'blam'},
        // },
    });
    client.start();

    setInterval(() => {}, 10000); // Keep running.
}

main();
