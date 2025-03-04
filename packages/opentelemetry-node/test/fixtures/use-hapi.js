/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-hapi.js

const http = require('http');
const Hapi = require('@hapi/hapi');

async function main() {
    const PORT = 3000;
    const server = Hapi.server({port: PORT, host: 'localhost'});
    server.route({
        method: 'GET',
        path: '/ping',
        handler: (request, h) => {
            return '/pong';
        },
    });
    server.route({
        method: 'GET',
        path: '/hi/{name}',
        handler: (request, h) => {
            return `Hi, ${request.params.name || 'buddy'}.`;
        },
    });
    await server.start();

    await new Promise((resolve) => {
        http.get(`http://localhost:${PORT}/ping`, (res) => {
            console.log('GET /ping: statusCode=%s', res.statusCode);
            res.resume();
            res.on('end', resolve);
        });
    });
    await new Promise((resolve) => {
        http.get(`http://localhost:${PORT}/hi/Bob`, (res) => {
            console.log('GET /hi/Bob: statusCode=%s', res.statusCode);
            res.resume();
            res.on('end', resolve);
        });
    });

    await server.stop({timeout: 1000});
}

main();
