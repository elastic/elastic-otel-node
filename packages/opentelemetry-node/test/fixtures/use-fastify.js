// Usage: node -r @elastic/opentelemetry-node use-fastify.js

const http = require('http');

const fastify = require('fastify');

const server = fastify();
server.get('/ping', function (req, reply) {
    reply.send('pong');
});

server.get('/hi/:name', function (req, reply) {
    reply.send(`Hi, ${req.params?.name || 'buddy'}.`);
});

async function main() {
    await server.listen({port: 3000});

    const port = server.server.address().port;

    await new Promise((resolve) => {
        http.get(`http://localhost:${port}/ping`, (res) => {
            res.resume();
            res.on('end', resolve);
        });
    });
    await new Promise((resolve) => {
        http.get(`http://localhost:${port}/hi/Bob`, (res) => {
            res.resume();
            res.on('end', resolve);
        });
    });

    server.close();
}

main();
