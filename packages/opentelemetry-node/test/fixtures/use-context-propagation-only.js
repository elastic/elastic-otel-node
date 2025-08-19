/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This makes HTTP calls for a small distributed trace (client -> serviceA ->
 * serviceB), to be able to test ELASTIC_OTEL_CONTEXT_PROPAGATION_ONLY=true.
 *
 * Usage:
    ELASTIC_OTEL_CONTEXT_PROPAGATION_ONLY=true \
        ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING=true \
        node --import @elastic/opentelemetry-node test/fixtures/use-context-propagation-only.js
 */

const http = require('http');
const bunyan = require('bunyan');

async function main() {
    const logB = bunyan.createLogger({name: 'serverB'});
    const serverB = http.createServer((req, res) => {
        logB.info({headers: req.headers}, 'incoming request');
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
    let serverBUrl;
    await new Promise((resolve) => {
        serverB.listen(0, '127.0.0.1', function () {
            const addr = serverB.address();
            serverBUrl = `http://${addr.address}:${addr.port}/`;
            resolve();
        });
    });

    const logA = bunyan.createLogger({name: 'serverA'});
    const serverA = http.createServer((req, res) => {
        logA.info({headers: req.headers}, 'incoming request');
        req.resume();
        req.on('end', function () {
            http.get(serverBUrl, function (cres) {
                const chunks = [];
                cres.on('data', function (chunk) {
                    chunks.push(chunk);
                });
                cres.on('end', function () {
                    const body = chunks.join('');
                    res.writeHead(200, {
                        'content-type': 'text/plain',
                        'content-length': Buffer.byteLength(body),
                    });
                    res.end(body);
                });
            });
        });
    });
    let serverAUrl;
    await new Promise((resolve) => {
        serverA.listen(0, '127.0.0.1', function () {
            const addr = serverA.address();
            serverAUrl = `http://${addr.address}:${addr.port}/`;
            resolve();
        });
    });

    const log = bunyan.createLogger({name: 'client'});
    await new Promise((resolve) => {
        http.get(serverAUrl, function (cres) {
            const chunks = [];
            cres.on('data', function (chunk) {
                chunks.push(chunk);
            });
            cres.on('end', function () {
                const content = chunks.join('');
                log.info({url: serverAUrl, content}, 'client request');
                resolve();
            });
        });
    });

    serverA.close();
    serverB.close();
}

main();
