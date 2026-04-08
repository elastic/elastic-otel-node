const http = require('http');

const NAME = 'a';
const PORT = 3300;

const server = http.createServer(function onRequest(req, res) {
    console.log('[%s] incoming request: %s %s %s', NAME, req.method, req.url, req.headers);
    req.resume();
    req.on('end', function () {
        // Call service B.
        http.get('http://127.0.0.1:3301', (cres) => {
            cres.resume()
            cres.on('end', () => {
                res.writeHead(200);
                res.end();
            });
        });
    });
});

server.listen(PORT, '127.0.0.1', async function () {
    console.log('[%s] listening:', NAME, server.address());
});
