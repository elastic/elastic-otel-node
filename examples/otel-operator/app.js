/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// A simple Express app with a `GET /ping` endpoint.

const bunyan = require('bunyan');
const express = require('express');
const {metrics} = require('@opentelemetry/api');

const log = bunyan.createLogger({
    name: 'myapp',
    serializers: bunyan.stdSerializers,
});

// A silly counter to demonstrate using custom OTel metrics.
const meter = metrics.getMeter('myapp');
const counter = meter.createCounter('num_pings');

const app = express();
app.get('/ping', function ping(req, res, next) {
    log.info({req, res}, 'ping');
    counter.add(1);
    res.send('pong');
});
app.use(function onError(err, _req, res, _next) {
    res.status(500);
    log.info({err}, 'internal error');
    res.send(`internal error: ${err.message}`);
});

const server = app.listen(3000, '0.0.0.0', () => {
    log.info({addr: server.address()}, 'listening');
});
