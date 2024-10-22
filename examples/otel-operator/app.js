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
