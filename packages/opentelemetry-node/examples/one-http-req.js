// Start an HTTP server and make a single request to it.
//
// Usage:
//      OTEL_SERVICE_NAME=one-http-req node -r ../start.js one-http-req.js
//      OTEL_SERVICE_NAME=one-http-req-tel1 node -r ./telemetry.js one-http-req.js
//      OTEL_SERVICE_NAME=one-http-req-tel2 node -r ./telemetry2.js one-http-req.js

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
    // Make a request to our HTTP server listening at http://localhost:3000.
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
