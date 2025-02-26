/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// A simple Express app with a `GET /ping` endpoint.
const express = require('express');

const app = express();
app.get('/ping', function ping(req, res, next) {
    console.log('[%s] server /ping', new Date().toISOString());
    res.send('pong');
});
app.use(function onError(err, req, res, next) {
    res.status(500);
    res.send(`internal error: ${err.message}`);
});

const server = app.listen(3000, '0.0.0.0', () => {
    console.log('Listening on', server.address());
});

// Call this local server after a couple seconds so we have trace data from
// at least one request.
setTimeout(async () => {
    await fetch('http://127.0.0.1:3000/ping');
}, 2000);
