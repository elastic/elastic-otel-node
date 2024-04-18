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

// Start an HTTP server and make a request to it.
// Usage:
//  node -r @elastic/opentelemetry-node/start.js simple-http-request.js

const http = require('http');

const server = http.createServer(function onRequest(req, res) {
    console.log('incoming request: %s %s %s', req.method, req.url, req.headers);
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

server.listen(3000, function () {
    const clientReq = http.request('http://localhost:3000/', function (cres) {
        console.log('client response: %s %s', cres.statusCode, cres.headers);
        const chunks = [];
        cres.on('data', function (chunk) {
            chunks.push(chunk);
        });
        cres.on('end', function () {
            const body = chunks.join('');
            console.log('client response body: %j', body);
            server.close();
        });
    });
    clientReq.end();
});
