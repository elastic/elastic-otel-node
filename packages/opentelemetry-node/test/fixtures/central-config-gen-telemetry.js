/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// This script (a) waits for the OpAMP client used internally by EDOT Node.js
// to have a chance to receive central config, then (b) generates various
// telemetry signals that can be impacted by that central config. This allows
// a test driver to expect different telemetry from this script depending on
// the set central config.

const http = require('http');
const pino = require('pino');
const {setTimeout} = require('timers/promises');
const otel = require('@opentelemetry/api');
const {
    DIAG_CH_SEND_SUCCESS,
    barrierOpAMPClientDiagEvents,
} = require('./ccutils.js');

const log = pino();
const tracer = otel.trace.getTracer('central-config-gen-telemetry');

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

async function main() {
    await new Promise((resolve) => {
        localServer.listen(0, '127.0.0.1', function () {
            resolve();
        });
    });

    if (process.env.ELASTIC_OTEL_OPAMP_ENDPOINT) {
        // We wait for *two* sends from the OpAMP client to, for any possible
        // remote config to be applied. The expected 2 sends are:
        // 1. initial heartbeat which receives `remoteConfig`, and
        // 2. client message with `remoteConfigStatus`
        await barrierOpAMPClientDiagEvents(2, [DIAG_CH_SEND_SUCCESS]);
        // Wait for a couple metric intervals before proceeding, so that
        // already recording metrics can be excluded in tests.
        const metricInterval = Number(process.env.OTEL_METRIC_EXPORT_INTERVAL);
        await setTimeout(metricInterval * 2);
    }

    await tracer.startActiveSpan('manual-span', async (span) => {
        log.info('hi at info level');

        const addr = localServer.address();
        const url = `http://${addr.address}:${addr.port}`;
        await makeReq(url);

        span.end();
    });

    localServer.close();
}

main();
