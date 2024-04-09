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

// Usage: node -r ../../start.js use-fastify.js

const http = require('http');

const fastify = require('fastify');

const server = fastify();
server.get('/ping', function (req, reply) {
    reply.send('pong');
});

server.get('/hi/:name', function (req, reply) {
    reply.send(`Hi, ${req.params?.name || 'buddy'}.`);
});

async function main() {
    await server.listen({port: 3000});

    const port = server.server.address().port;

    await new Promise((resolve) => {
        http.get(`http://localhost:${port}/ping`, (res) => {
            res.resume();
            res.on('end', resolve);
        });
    });
    await new Promise((resolve) => {
        http.get(`http://localhost:${port}/hi/Bob`, (res) => {
            res.resume();
            res.on('end', resolve);
        });
    });

    server.close();
}

main();
