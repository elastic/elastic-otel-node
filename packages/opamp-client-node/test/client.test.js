/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const fs = require('fs');
const path = require('path');

const luggite = require('luggite');
const {test} = require('tape');
const {MockOpAMPServer} = require('@elastic/mockopampserver');

const {
    createOpAMPClient,
    RemoteConfigStatuses,
    AgentCapabilities,
    DIAG_CH_SEND_SUCCESS,
    DIAG_CH_SEND_FAIL,
} = require('..');
const {objFromKeyValues, isEqualUint8Array} = require('../lib/utils');
const {barrierNDiagEvents} = require('./testutils');

const log = luggite.createLogger({name: 'client-test', level: 'info'});
// log.level('trace'); // Dev: Uncomment this for log output from the client.

const TEST_CERTS_DIR = path.resolve(__dirname, 'certs');

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

    // This test mimics the preceding "minimal usage", adding only mTLS
    // config for the OpAMP server and client.
    suite.test('minimal usage, with mTLS', async (t) => {
        const opampServer = new MockOpAMPServer({
            logLevel: 'warn', // use 'debug' for some debugging of the server
            // logLevel: 'debug',
            port: 0,
            testMode: true,
            // mTLS config:
            ca: fs.readFileSync(path.join(TEST_CERTS_DIR, 'ca.crt')),
            cert: fs.readFileSync(path.join(TEST_CERTS_DIR, 'server.crt')),
            key: fs.readFileSync(path.join(TEST_CERTS_DIR, 'server.key')),
            requestCert: true,
        });
        await opampServer.start();

        // Unfortunately we cannot use the `opampServer.endpoint` directly.
        // Currently MockOpAMPServer resolves the default `localhost` hostname
        // to the IP address. However, we need to access the server using the
        // "CN" (Common Name) used in the server certificate: "localhost"
        // (see test/certs/regenerate.sh).
        const u = new URL(opampServer.endpoint);
        u.hostname = 'localhost';
        const endpoint = u.href;

        // Minimal usage of the OpAMP client, with mTLS config.
        const client = createOpAMPClient({
            log,
            endpoint: endpoint,
            diagEnabled: true,
            // mTLS config:
            connect: {
                ca: fs.readFileSync(path.join(TEST_CERTS_DIR, 'ca.crt')),
                cert: fs.readFileSync(path.join(TEST_CERTS_DIR, 'client.crt')),
                key: fs.readFileSync(path.join(TEST_CERTS_DIR, 'client.key')),
            },
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

    suite.test('client.setAgentDescription', async (t) => {
        const server = new MockOpAMPServer({
            logLevel: 'warn', // use 'debug' for some debugging of the server
            hostname: '127.0.0.1',
            port: 0,
            testMode: true,
        });
        await server.start();

        const client = createOpAMPClient({
            log,
            endpoint: server.endpoint,
            diagEnabled: true,
        });
        const desc = {
            identifyingAttributes: {
                'service.name': 'foo-bar',
            },
            // Exercise the various value types.
            nonIdentifyingAttributes: {
                aStr: 'strVal',
                aBool: true,
                aBool2: false,
                anInt: 42,
                aFloat: 3.141,
                aBigInt: 1152921504606846976n, // less than 2**64, bigger than MAX_SAFE_INTEGER
                aBuffer: Buffer.from([1, 2, 3]),
                anArray: [1, 2, 3, 'a', 'b', 'c', {spam: 'eggs'}],
                anObj: {foo: 'bar', baz: 'blam'},
            },
        };
        const instanceUid = client.getInstanceUid();
        client.setAgentDescription(desc);
        client.start();

        // events: 1. send.schedule, 2. send.success, 3. send.schedule.
        await barrierNDiagEvents(3);

        const serverAgentInfo = server.getActiveAgent(instanceUid);
        t.ok(serverAgentInfo);
        t.deepEqual(
            serverAgentInfo.getIdentifyingAttributes(),
            desc.identifyingAttributes
        );
        t.deepEqual(
            serverAgentInfo.getNonIdentifyingAttributes(),
            desc.nonIdentifyingAttributes
        );

        // Test changing the description again:
        // - Ensure the server gets the update, and
        // - ensure a Uint8Array value works, which is more finnicky to test
        //   because it gets translated to a `Buffer` by bufbuild (the protobuf
        //   lib).
        const desc2 = {
            identifyingAttributes: desc.identifyingAttributes,
            nonIdentifyingAttributes: {
                aUint8Array: new Uint8Array([4, 5, 6]),
            },
        };
        client.setAgentDescription(desc2);
        await barrierNDiagEvents(2); // events: 1. send.success, 2. send.schedule
        const serverAgentInfo2 = server.getActiveAgent(instanceUid);
        t.ok(serverAgentInfo2);
        t.deepEqual(
            serverAgentInfo2.getIdentifyingAttributes(),
            desc2.identifyingAttributes
        );
        const nia2 = serverAgentInfo2.getNonIdentifyingAttributes();
        t.equal(Object.keys(nia2).length, 1);
        t.ok(
            isEqualUint8Array(
                nia2.aUint8Array, // Buffer
                desc2.nonIdentifyingAttributes.aUint8Array // Uint8Array
            ),
            'aUint8Array attribute matches'
        );

        await client.shutdown();
        await server.close();
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

        await barrierNDiagEvents(3, [DIAG_CH_SEND_SUCCESS, DIAG_CH_SEND_FAIL]);
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

    suite.test('remote config: error status', async (t) => {
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

        // Setup OpAMPClient to receive remote config and report an error
        // status in applying it.
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
                setTimeout(() => {
                    client.setRemoteConfigStatus({
                        status: RemoteConfigStatuses.RemoteConfigStatuses_FAILED,
                        lastRemoteConfigHash: remoteConfig.configHash,
                        errorMessage: 'some error message',
                    });
                }, 100);
            },
        });
        client.setAgentDescription({identifyingAttributes: {foo: 'bar'}});
        client.start();

        // Expected interaction:
        //  - soon after start:
        //    AgentToServer: "Hello, my name is Bob."
        //    ServerToAgent: "Bob, here is some remote config."
        //  - soon after:
        //    AgentToServer: "Remote config FAILED, with an error message."
        //    ServerToAgent: (minimal empty response)
        //  - after next heartbeat interval
        //    AgentToServer: (minimal empty heartbeat)
        //    ServerToAgent: (minimal empty response)
        // Checking that last request ensures that ReportRemoteConfig is working
        // to reduce the noise of re-sending the same config all the time.

        await barrierNDiagEvents(3, [DIAG_CH_SEND_SUCCESS, DIAG_CH_SEND_FAIL]);
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
            RemoteConfigStatuses.RemoteConfigStatuses_FAILED
        );

        // The server has that updated RemoteConfigStatus.
        const aa = opampServer.getActiveAgent(client.getInstanceUid());
        t.equal(
            aa.remoteConfigStatus.status,
            RemoteConfigStatuses.RemoteConfigStatuses_FAILED
        );
        t.equal(aa.remoteConfigStatus.errorMessage, 'some error message');

        // The third request/response was minimal, i.e. we are in a steady
        // state of heartbeating.
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

    suite.end();
});
