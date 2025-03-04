/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
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
