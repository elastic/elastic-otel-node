// Usage: node -r @elastic/opentelemetry-node use-http-server.js
//
// This starts a simple echo server, makes two requests to it, then stops the
// server.

const http = require('http');

const server = http.createServer(function onRequest(req, res) {
    console.log('incoming request: %s %s %s', req.method, req.url, req.headers);
    if (req.url !== '/echo') {
        req.resume();
        res.writeHead(404);
        res.end();
        return;
    }
    if (req.method !== 'POST') {
        req.resume();
        res.writeHead(405, {
            Allow: 'POST',
        });
        res.end();
        return;
    }

    const chunks = [];
    req.on('data', (chunk) => {
        chunks.push(chunk);
    });
    req.on('end', function () {
        const body = Buffer.concat(chunks);
        res.writeHead(200, {
            'content-type': 'application/octet-stream',
            'content-length': Buffer.byteLength(body),
        });
        res.end(body);
    });
});

server.listen(0, '127.0.0.1', async function () {
    const port = server.address().port;

    // First request to show a client error.
    await new Promise((resolve) => {
        const clientReq = http.request(
            `http://127.0.0.1:${port}/`,
            function (cres) {
                console.log(
                    'client response: %s %s',
                    cres.statusCode,
                    cres.headers
                );
                const chunks = [];
                cres.on('data', function (chunk) {
                    chunks.push(chunk);
                });
                cres.on('end', function () {
                    const body = chunks.join('');
                    console.log('client response body: %j', body);
                    resolve();
                });
            }
        );
        clientReq.end();
    });

    await new Promise((resolve) => {
        const clientReq = http.request(
            `http://127.0.0.1:${port}/echo`,
            {
                method: 'POST',
            },
            function (cres) {
                console.log(
                    'client response: %s %s',
                    cres.statusCode,
                    cres.headers
                );
                const chunks = [];
                cres.on('data', function (chunk) {
                    chunks.push(chunk);
                });
                cres.on('end', function () {
                    const body = chunks.join('');
                    console.log('client response body: %j', body);
                    resolve();
                });
            }
        );
        clientReq.write('hi');
        clientReq.end();
    });

    server.close();
});
