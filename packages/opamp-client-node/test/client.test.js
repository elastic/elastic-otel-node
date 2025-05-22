/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {setTimeout: setTimeoutP} = require('timers/promises');
const {subscribe} = require('diagnostics_channel');

const luggite = require('luggite');
const {test} = require('tape');
const {MockOpAMPServer} = require('@elastic/mockopampserver');

const {
    DIAG_CH_SEND_SUCCESS,
    DIAG_CH_SEND_FAIL,
    DIAG_CH_SEND_SCHEDULE,
    createOpAMPClient,
} = require('..');
const {objFromKeyValues, isEqualUint8Array} = require('../lib/utils');

const log = luggite.createLogger({name: 'client-test', level: 'info'});
// XXX
log.level('trace'); // Dev: Uncomment this for log output from the client.

function numIsApprox(val, expectedVal, epsilonRatio) {
    const epsilon = expectedVal * epsilonRatio;
    return Math.abs(val - expectedVal) < epsilon;
}

test('createOpAMPClient', (suite) => {
    let opampServer;

    suite.test('setup', async (t) => {
        opampServer = new MockOpAMPServer({
            logLevel: 'warn', // use 'debug' for some debugging of the server
            // logLevel: 'debug',
            hostname: '127.0.0.1',
            port: 0,
            testMode: true,
        });
        await opampServer.start();
        t.comment(`MockOpAMPServer started: ${opampServer.endpoint}`);
    });

    suite.test('minimal usage', async (t) => {
        opampServer.testReset();

        // Minimal usage of the OpAMP client.
        const client = createOpAMPClient({
            log,
            endpoint: opampServer.endpoint,
        });
        client.setAgentDescription({
            identifyingAttributes: {
                foo: 'bar',
            },
        });
        const instanceUid = client.getInstanceUid();
        client.start();
        await setTimeoutP(100); // Could do better. This is a race.
        client.shutdown();

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

        t.end();
    });

    suite.test('error case: ECONNREFUSED', async (t) => {
        opampServer.testReset();
        const bogusEndpoint = 'http://127.0.0.1:6666/v1/opamp';
        t.notEqual(opampServer.endpoint, bogusEndpoint);

        let failMsg;
        let schedMsg;
        subscribe(DIAG_CH_SEND_FAIL, (msg) => {
            failMsg = msg;
        });
        subscribe(DIAG_CH_SEND_SCHEDULE, (msg) => {
            schedMsg = msg;
        });

        const client = createOpAMPClient({
            log,
            endpoint: bogusEndpoint,
            diagEnabled: true,
        });
        client.setAgentDescription({identifyingAttributes: {foo: 'bar'}});
        client.start();
        await setTimeoutP(100); // Could do better. This is a race.
        client.shutdown();

        // Expect a send failure and a scheduled next send in 30s (with jitter).
        t.ok(
            isEqualUint8Array(failMsg.a2s.instanceUid, client.getInstanceUid())
        );
        t.equal(failMsg.err.code, 'ECONNREFUSED');
        t.equal(schedMsg.errCount, 1);
        t.ok(numIsApprox(schedMsg.delayMs, 30000, 0.1)); // allow 10% jitter on expected 30s

        t.end();
    });

    // TODO: test that the backoff is the expected exponential.
    // TODO: test usage with OTel resource (see example in README)
    // TODO: test remote config, once have support for that (with and
    //      without reporting remote config status)

    suite.test('teardown', async (t) => {
        if (opampServer) {
            await opampServer.close();
        }
    });

    suite.end();
});
