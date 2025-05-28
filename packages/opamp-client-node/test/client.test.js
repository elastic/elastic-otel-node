/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const luggite = require('luggite');
const {test} = require('tape');
const {MockOpAMPServer} = require('@elastic/mockopampserver');

const {createOpAMPClient} = require('..');
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

    // TODO: test usage with OTel resource (see example in README)
    // TODO: test remote config, once have support for that (with and
    //      without reporting remote config status)

    suite.end();
});
