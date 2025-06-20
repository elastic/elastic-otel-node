/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage:
//  ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL=500 \
//      ELASTIC_OTEL_TEST_OPAMP_CLIENT_DIAG_ENABLED=true \
//      ELASTIC_OTEL_OPAMP_ENDPOINT=http://127.0.0.1:4320/v1/opamp \
//      node --import=./import.mjs test/fixtures/exercise-central-config.js
//
// Run through a scenario that tests that central config works.
// ("ASSERT" notes below are things that the driving test file can assert.)
//
// Expectations:
// - A MockOpAMPServer is running at `ELASTIC_OTEL_OPAMP_ENDPOINT`, in
//   `testMode` (so that it supports `POST /api/agentConfigMap` to change the
//   remote config payload).
// - A MockOTLPServer is running that receives telemetry that can be
//   asserted on.
//
// Scenario:
// - Start a local HTTP server (which generates instrumentation-http telemetry)
// - Call it with `fetch` (which generates instrumentation-undici telemetry)
//      - ASSERT: a trace with these two spans
// - Set `{"logging_level": "debug"}` agent config; wait for the
//   opamp-client-node to receive that.
//      - ASSERT: application log includes: {"name":"elastic-otel-node","level":30,"msg":"central-config: set \"logging_level\" to \"debug\"",...}
// - Set agent config to empty; wait for the
//   opamp-client-node to receive that.
//      - ASSERT: application log includes: {"name":"elastic-otel-node","level":30,"msg":"central-config: reset \"logging_level\" to \"info\"",...}
// - ASSERT: Assertions on telemetry to be made by the driver test:
//   - A trace of the local HTTP call, something like:
//          span 49f0b7 "GET" (5.2ms, SPAN_KIND_CLIENT, GET http://127.0.0.1:51261/ -> 200)
//          `- span 5bc961 "GET" (1.3ms, SPAN_KIND_SERVER, GET -> 200)
//   - There should *not* be any spans tracing the OpAMP client calls.

const {subscribe, unsubscribe} = require('diagnostics_channel');
const http = require('http');

const {
    DIAG_CH_SEND_SUCCESS,
    DIAG_CH_SEND_FAIL,
    DIAG_CH_SEND_SCHEDULE,
} = require('@elastic/opamp-client-node');

const localServer = http.createServer(function onRequest(req, res) {
    console.log('\nlocal: incoming request: %s %s', req.method, req.url);
    req.resume();
    req.on('end', function () {
        const body = 'pong';
        res.writeHead(200, {
            'content-type': 'text/plain',
            'content-length': Buffer.byteLength(body),
        });
        res.end(body);
    });
});

async function makeReq(url) {
    const cres = await fetch(url);
    console.log('local: fetch response status=%s', cres.status);
    const body = await cres.text();
    console.log('local: fetch body: %s', body);
}

async function setAgentConfig(config) {
    const u = new URL(process.env.ELASTIC_OTEL_OPAMP_ENDPOINT);
    u.pathname = '/api/agentConfigMap';
    const res = await fetch(u.href, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(config),
    });
    if (res.status === 204) {
        await res.arrayBuffer(); // https://undici.nodejs.org/#/?id=garbage-collection
    } else {
        const errBody = await res.text();
        throw new Error(
            `failed to set Agent Config on OpAMP server: 'POST ${u.href}' responded: ${res.status}, ${errBody}`
        );
    }
}

/**
 * Wait for `n` OpAMPClient diagnostics channel events, and return them.
 * (Copied from "opamp-client-node/test/testutils.js".)
 */
function barrierNDiagEvents(n, channels) {
    const chNames = channels || [
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
            // Use `setImmediate` to work around a bug in diagnostics_channel
            // unsubscribing *during* a publish. This was breaking tests with
            // Node.js v18.20.8.
            // https://github.com/nodejs/node/pull/55116
            setImmediate(() => {
                chNames.forEach((ch) => {
                    unsubscribe(ch, onEvent);
                });
                barrierResolve(events);
            });
        }
    };
    chNames.forEach((ch) => {
        subscribe(ch, onEvent);
    });
    return barrier;
}

async function main() {
    await new Promise((resolve) => {
        localServer.listen(0, '127.0.0.1', function () {
            resolve();
        });
    });
    const addr = localServer.address();
    const url = `http://${addr.address}:${addr.port}`;
    await makeReq(url);

    // Call the OpAMP *server* with some agent config. Then wait for the
    // OpAMP *client* in the OTel SDK instrumenting this script, to receive
    // that new config. We wait for *three* sends from the OpAMP client to
    // avoid a race where the client is just sending a heartbeat while
    // `setAgentConfig` is being called.
    setAgentConfig({
        elastic: {body: JSON.stringify({logging_level: 'debug'})},
    });
    await barrierNDiagEvents(3, [DIAG_CH_SEND_SUCCESS]);

    setAgentConfig({
        elastic: {body: JSON.stringify({})},
    });
    await barrierNDiagEvents(3, [DIAG_CH_SEND_SUCCESS]);

    localServer.close();
}

main();
