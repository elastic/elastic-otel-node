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

// Usage: node -r @elastic/opentelemetry-node use-express.js
// TODO: add express.Router() usage, error capture with error handler? See examples/express-app.js.

const http = require('http');
const express = require('express');

const app = express();
app.get('/ping', (_req, res) => {
    res.send('pong');
});
app.get('/hi/:name', (req, res) => {
    res.send(`Hi, ${req.params?.name || 'buddy'}.`);
});

const server = app.listen(async function () {
    const addr = server.address();

    await new Promise((resolve) => {
        http.get(`http://localhost:${addr.port}/ping`, (res) => {
            res.resume();
            res.on('end', resolve);
        });
    });
    await new Promise((resolve) => {
        http.get(`http://localhost:${addr.port}/hi/Bob`, (res) => {
            res.resume();
            res.on('end', resolve);
        });
    });

    server.close();
});
