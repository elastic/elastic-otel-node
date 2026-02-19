/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const http = require('http');

const server = http.createServer(function onRequest(req, res) {
    console.log('incoming request: %s %s %s', req.method, req.url, req.headers);
    req.resume();
    req.on('end', function () {
        const body = 'pong';
        // TODO: the issue when only res.writeHead()
        res.setHeader('Server', 'capture-header-example');
        res.setHeader('DeuxFois', ['C', 'D']);
        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200, {
            'content-type': 'text/plain', // wins over earlier setHeader
            'content-length': Buffer.byteLength(body),
        });
        res.end(body);
    });
});

server.listen(0, '127.0.0.1', async function () {
    const port = server.address().port;

    // Make one request the `http`.
    await new Promise((resolve) => {
        const clientReq = http.request(
            `http://127.0.0.1:${port}/via-http`,
            {
                headers: {
                    Foo: 'Bar',
                },
            },
            function (cres) {
                console.log(
                    'http.request response: %s %s',
                    cres.statusCode,
                    cres.headers
                );
                cres.resume();
                cres.on('end', resolve);
            }
        );
        clientReq.end();
    });

    // Make second request with undici.
    const res = await fetch(`http://127.0.0.1:${port}/via-fetch`, {
        headers: [
            ['Spam', 'Eggs'],
            ['Twice', 'A'],
            ['Twice', 'B'],
        ],
    });
    console.log(
        'fetch response: %s %o',
        res.status,
        Object.fromEntries(res.headers.entries())
    );
    await res.bytes();

    server.close();
});
