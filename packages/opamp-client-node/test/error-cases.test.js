/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const http = require('http');

const luggite = require('luggite');
const {test} = require('tape');
const {MockOpAMPServer} = require('@elastic/mockopampserver');

const {createOpAMPClient} = require('..');
const {barrierNDiagEvents, numIsApprox} = require('./testutils');

const log = luggite.createLogger({name: 'error-cases-test', level: 'info'});
// log.level('trace'); // Dev: Uncomment this for log output from the client.

test('OpAMPClient error cases', (suite) => {
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

    suite.end();
});
