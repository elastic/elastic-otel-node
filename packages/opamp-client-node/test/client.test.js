/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {subscribe, unsubscribe} = require('diagnostics_channel');
const http = require('http');

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
// log.level('trace'); // Dev: Uncomment this for log output from the client.

function numIsApprox(val, expectedVal, epsilonRatio) {
    const epsilon = expectedVal * epsilonRatio;
    return Math.abs(val - expectedVal) < epsilon;
}

/**
 * Wait for `n` OpAMPClient diagnostics channel events, and return them.
 *
 * @param {Number} n
 * @returns {Promise<any>}
 */
function barrierNDiagEvents(n) {
    const chNames = [
        DIAG_CH_SEND_SUCCESS,
        DIAG_CH_SEND_FAIL,
        DIAG_CH_SEND_SCHEDULE,
    ];
    const events = [];
    let barrierResolve;
    const barrier = new Promise((resolve) => {
        barrierResolve = resolve;
    });
    const onEvent = (e) => {
        // console.log('barrierNDiagEvents: onEvent:', e);
        events.push(e);
        if (events.length >= n) {
            chNames.forEach((ch) => {
                unsubscribe(ch, onEvent);
            });
            barrierResolve(events);
        }
    };
    chNames.forEach((ch) => {
        subscribe(ch, onEvent);
    });
    return barrier;
}

test('createOpAMPClient', (suite) => {
    let opampServer;

    suite.test('minimal usage', async (t) => {
        opampServer = new MockOpAMPServer({
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

    suite.test('error: ECONNREFUSED', async (t) => {
        // Need to ensure the process has an active handle, else `tape` will
        // end the tests prematurely. It does *not* wait for `t.end()` to be
        // called in async test handlers.
        const hackInterval = setInterval(() => {}, 1000);

        const bogusEndpoint = 'http://127.0.0.1:6666/v1/opamp';

        const client = createOpAMPClient({
            log,
            endpoint: bogusEndpoint,
            diagEnabled: true,
        });
        client.setAgentDescription({identifyingAttributes: {foo: 'bar'}});
        client.start();
        const events = await barrierNDiagEvents(3);

        // Expect a send failure and a scheduled next send in 30s (with jitter).
        t.equal(events[1].err.code, 'ECONNREFUSED');
        t.equal(events[2].errCount, 1);
        t.ok(numIsApprox(events[2].delayMs, 30000, 0.1)); // allow 10% jitter on expected 30s

        client.shutdown();
        t.end();
        clearInterval(hackInterval);
    });

    suite.test('error: unexpected response status code', async (t) => {
        // Start a "bad" OpAMP server that responds 201, rather than 200.
        const badOpampServer = http.createServer((req, res) => {
            req.resume();
            req.on('end', () => {
                res.writeHead(202); // Bad response status code.
                res.end();
            });
        });
        const addr = await new Promise((resolve) => {
            badOpampServer.listen(0, '127.0.0.1', async () => {
                resolve(badOpampServer.address());
            });
        });

        const endpoint = `http://${addr.address}:${addr.port}/v1/opamp`;
        const client = createOpAMPClient({
            log,
            endpoint,
            diagEnabled: true,
        });
        client.setAgentDescription({identifyingAttributes: {foo: 'bar'}});
        client.start();

        // Expect a send failure and a scheduled next send in 30s (with jitter).
        const events = await barrierNDiagEvents(3);
        t.ok(events[1].err.includes('unexpected'));
        t.equal(events[2].errCount, 1);
        t.ok(numIsApprox(events[2].delayMs, 30000, 0.1)); // allow 10% jitter on expected 30s

        badOpampServer.close();
        client.shutdown();
        t.end();
    });

    suite.test('HTTP 429 with Retry-After', async (t) => {
        const retryAfterS = 45;
        const badOpampServer = http.createServer((req, res) => {
            req.resume();
            req.on('end', () => {
                res.writeHead(429, {'retry-after': retryAfterS});
                res.end();
            });
        });
        const addr = await new Promise((resolve) => {
            badOpampServer.listen(0, '127.0.0.1', async () => {
                resolve(badOpampServer.address());
            });
        });
        const endpoint = `http://${addr.address}:${addr.port}/v1/opamp`;

        const client = createOpAMPClient({
            log,
            endpoint,
            diagEnabled: true,
        });
        client.setAgentDescription({identifyingAttributes: {foo: 'bar'}});
        client.start();

        // Expect the schedule event to be 45s (with jitter).
        const events = await barrierNDiagEvents(3);
        t.equal(events[1].retryAfterMs, retryAfterS * 1000);
        t.ok(numIsApprox(events[2].delayMs, retryAfterS * 1000, 0.1));

        await client.shutdown();
        badOpampServer.close();
        t.end();
    });

    suite.test('HTTP 503 with Retry-After', async (t) => {
        const retryAfterS = 42;
        const badOpampServer = http.createServer((req, res) => {
            req.resume();
            req.on('end', () => {
                res.writeHead(429, {'retry-after': retryAfterS});
                res.end();
            });
        });
        const addr = await new Promise((resolve) => {
            badOpampServer.listen(0, '127.0.0.1', async () => {
                resolve(badOpampServer.address());
            });
        });
        const endpoint = `http://${addr.address}:${addr.port}/v1/opamp`;

        const client = createOpAMPClient({
            log,
            endpoint,
            diagEnabled: true,
        });
        client.setAgentDescription({identifyingAttributes: {foo: 'bar'}});
        client.start();

        // Expect the schedule event to be `retryAfterS` (with jitter).
        const events = await barrierNDiagEvents(3);
        t.equal(events[1].retryAfterMs, retryAfterS * 1000);
        t.ok(numIsApprox(events[2].delayMs, retryAfterS * 1000, 0.1));

        await client.shutdown();
        badOpampServer.close();
        t.end();
    });

    suite.test('error: slow response body (bodyTimeout)', async (t) => {
        // Start a "bad" OpAMP server that is slow to respond with the body.
        const badOpampServer = http.createServer((req, res) => {
            req.resume();
            req.on('end', () => {
                setTimeout(() => {
                    res.writeHead(200, {
                        'content-type': 'application/x-protobuf',
                    });
                    res.flushHeaders();
                }, 200).unref();
                setTimeout(() => {
                    res.end();
                }, 5000).unref(); // Longer than the 100ms bodyTimeout below.
            });
        });
        const addr = await new Promise((resolve) => {
            badOpampServer.listen(0, '127.0.0.1', async () => {
                resolve(badOpampServer.address());
            });
        });
        const endpoint = `http://${addr.address}:${addr.port}/v1/opamp`;

        const client = createOpAMPClient({
            log,
            endpoint,
            diagEnabled: true,
            bodyTimeout: 100,
        });
        client.setAgentDescription({identifyingAttributes: {foo: 'bar'}});
        client.start();

        // Expect a send failure and a scheduled next send in 30s (with jitter).
        const events = await barrierNDiagEvents(3);
        t.equal(events[1].err.code, 'UND_ERR_BODY_TIMEOUT');
        t.ok(numIsApprox(events[2].delayMs, 30000, 0.1)); // allow 10% jitter on expected 30s

        await client.shutdown();
        badOpampServer.close();
        t.end();
    });

    suite.test('error: ServerErrorResponse.type=UNKNOWN', async (t) => {
        const badServer = new MockOpAMPServer({
            logLevel: 'warn',
            hostname: '127.0.0.1',
            port: 0,
            testMode: true,
            badMode: 'server_error_response_unknown',
        });
        await badServer.start();

        const client = createOpAMPClient({
            log,
            endpoint: badServer.endpoint,
            diagEnabled: true,
        });
        client.setAgentDescription({identifyingAttributes: {foo: 'bar'}});
        client.start();

        // Expect a send failure and a scheduled next send in 30s (with jitter).
        const events = await barrierNDiagEvents(3);
        t.ok(events[1].err.includes('Unknown'));
        t.ok(numIsApprox(events[2].delayMs, 30000, 0.1));

        await client.shutdown();
        badServer.close();
        t.end();
    });

    suite.test('error: ServerErrorResponse.type=UNAVAILABLE', async (t) => {
        const badServer = new MockOpAMPServer({
            logLevel: 'warn',
            hostname: '127.0.0.1',
            port: 0,
            testMode: true,
            badMode: 'server_error_response_unavailable',
        });
        await badServer.start();

        const client = createOpAMPClient({
            log,
            endpoint: badServer.endpoint,
            diagEnabled: true,
        });
        client.setAgentDescription({identifyingAttributes: {foo: 'bar'}});
        client.start();

        // Expect a send failure and a scheduled next send in 30s (with jitter).
        const events = await barrierNDiagEvents(3);
        t.ok(events[1].err.includes('Unavailable'));
        // 42s is the hardcode value used by server_error_response_unavailable.
        t.equal(events[1].retryAfterMs, 42000);
        t.ok(numIsApprox(events[2].delayMs, 42000, 0.1));

        await client.shutdown();
        badServer.close();
        t.end();
    });

    // TODO: test usage with OTel resource (see example in README)
    // TODO: test remote config, once have support for that (with and
    //      without reporting remote config status)

    suite.end();
});
