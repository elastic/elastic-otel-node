/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
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
