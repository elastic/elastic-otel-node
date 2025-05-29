/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const luggite = require('luggite');
const {test} = require('tape');
const {MockOpAMPServer} = require('@elastic/mockopampserver');

const {
    createOpAMPClient,
    RemoteConfigStatuses,
    AgentCapabilities,
} = require('..');
const {objFromKeyValues, isEqualUint8Array} = require('../lib/utils');
const {barrierNDiagEvents} = require('./testutils');

const log = luggite.createLogger({name: 'client-test', level: 'info'});
// log.level('trace'); // Dev: Uncomment this for log output from the client.

test('OpAMPClient', (suite) => {
    suite.test('minimal usage', async (t) => {
        const opampServer = new MockOpAMPServer({
            logLevel: 'warn', // use 'debug' for some debugging of the server
            // logLevel: 'debug',
            hostname: '127.0.0.1',
            port: 0,
            testMode: true,
        });
        await opampServer.start();

        // Minimal usage of the OpAMP client.
        const client = createOpAMPClient({
            log,
            endpoint: opampServer.endpoint,
            diagEnabled: true,
        });
        client.setAgentDescription({identifyingAttributes: {foo: 'bar'}});
        const instanceUid = client.getInstanceUid();
        client.start();

        // Wait until the client request/response has completed. The OpAMPClient
        // supports a diagnostics_channel-based feature to watch its
        // interfactions. The 3 expected events: send.schedule, send.success,
        // send.schedule.
        await barrierNDiagEvents(3);

        const reqs = opampServer.testGetRequests();
        t.equal(reqs.length, 1);
        // console.dir(reqs, {depth: 50});

        t.ok(isEqualUint8Array(instanceUid, reqs[0].a2s.instanceUid));
        t.equal(reqs[0].a2s.sequenceNum, 1n);
        t.deepEqual(
            objFromKeyValues(
                reqs[0].a2s.agentDescription.identifyingAttributes
            ),
            {foo: 'bar'}
        );

        t.ok(isEqualUint8Array(instanceUid, reqs[0].s2a.instanceUid));
        t.equal(
            reqs[0].s2a.flags,
            0,
            'ServerToAgent did not set ReportFullState flag'
        );

        await client.shutdown();
        await opampServer.close();
        t.end();
    });

    suite.test('remote config', async (t) => {
        // Setup MockOpAMPServer to provide `config` as remote config.
        const config = {foo: 42};
        const opampServer = new MockOpAMPServer({
            logLevel: 'warn',
            hostname: '127.0.0.1',
            port: 0,
            testMode: true,
            agentConfigMap: {
                configMap: {
                    '': {
                        contentType: 'application/json',
                        body: Buffer.from(JSON.stringify(config), 'utf8'),
                    },
                },
            },
        });
        await opampServer.start();

        // Setup OpAMPClient to receive remote config and report its status.
        let numOnMessageCalls = 0;
        let receivedRemoteConfig = null;
        const client = createOpAMPClient({
            log,
            endpoint: opampServer.endpoint,
            diagEnabled: true,
            heartbeatIntervalSeconds: 1, // reduce from 30 for a faster test
            capabilities:
                AgentCapabilities.AgentCapabilities_AcceptsRemoteConfig |
                AgentCapabilities.AgentCapabilities_ReportsRemoteConfig,
            onMessage: ({remoteConfig}) => {
                receivedRemoteConfig = remoteConfig;
                numOnMessageCalls += 1;
                client.setRemoteConfigStatus({
                    status: RemoteConfigStatuses.RemoteConfigStatuses_APPLIED,
                    lastRemoteConfigHash: remoteConfig.configHash,
                });
            },
        });
        client.setAgentDescription({identifyingAttributes: {foo: 'bar'}});
        client.start();

        // Expected interaction:
        //  - soon after start:
        //    AgentToServer: "Hello, my name is Bob."
        //    ServerToAgent: "Bob, here is some remote config."
        //  - soon after:
        //    AgentToServer: "Remote config APPLIED."
        //    ServerToAgent: (minimal empty response)
        //  - after next heartbeat interval
        //    AgentToServer: (minimal empty heartbeat)
        //    ServerToAgent: (minimal empty response)
        // Checking that last request ensures that ReportRemoteConfig is working
        // to reduce the noise of re-sending the same config all the time.

        await barrierNDiagEvents(6);
        // console.log('events: ', events);
        const reqs = opampServer.testGetRequests();
        // console.dir(reqs, {depth: 50});

        // The client received the expected remote config:
        t.equal(numOnMessageCalls, 1);
        t.ok(receivedRemoteConfig);
        const agentConfigFile = receivedRemoteConfig.config.configMap[''];
        t.equal(agentConfigFile.contentType, 'application/json');
        const receivedConfig = JSON.parse(
            new TextDecoder().decode(agentConfigFile.body)
        );
        t.deepEqual(receivedConfig, config);

        // The client subsequently sent a RemoteConfigStatus.
        const sentStatus = reqs[1].a2s.remoteConfigStatus;
        t.ok(sentStatus);
        t.equal(
            sentStatus.status,
            RemoteConfigStatuses.RemoteConfigStatuses_APPLIED
        );
        t.ok(
            isEqualUint8Array(
                sentStatus.lastRemoteConfigHash,
                receivedRemoteConfig.configHash
            ),
            'remote config hashes match'
        );

        // The third request/response was minimal.
        t.equal(reqs.length, 3);
        t.deepEqual(Object.keys(reqs[2].a2s), [
            '$typeName',
            'instanceUid',
            'sequenceNum',
            'capabilities',
            'flags',
        ]);
        t.deepEqual(Object.keys(reqs[2].s2a), [
            '$typeName',
            'instanceUid',
            'flags',
            'capabilities',
        ]);

        await client.shutdown();
        await opampServer.close();
        t.end();
    });

    // TODO: test usage with OTel resource (see example in README)

    suite.end();
});
