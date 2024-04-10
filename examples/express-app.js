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

// Usage:
//  node -r @elastic/opentelemetry-node/start.js express-app.js
//  curl -i http://127.0.0.1:3000/ping
//  curl -i http://127.0.0.1:3000/hi/Bob
//  curl -i http://127.0.0.1:3000/api/v1/things -X POST -d '"my-thing"' -H content-type:application/json
//  curl -i http://127.0.0.1:3000/api/v1/things

const crypto = require('crypto');
const express = require('express');

const things = [];

const app = express();
app.get('/ping', (_req, res) => {
    res.send('pong');
});
app.get('/hi/:name', (req, res) => {
    res.send(`Hi, ${req.params?.name || 'buddy'}.`);
});
const apiRouter = express.Router();
apiRouter.use(express.json({strict: false}));
apiRouter.get('/things', (req, res) => {
    res.send(things);
});
apiRouter.post('/things', (req, res) => {
    things.push({
        id: crypto.randomBytes(8).toString('hex'),
        thing: req.body,
    });
    res.send({result: 'ok'});
});
app.use('/api/v1', apiRouter);
app.use(function onError(err, req, res, next) {
    console.log('express-app err:', err);
    res.status(500);
    res.send('internal error');
});

const server = app.listen(3000, '127.0.0.1', function () {
    console.log('listening at:', server.address());
});
