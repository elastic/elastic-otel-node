/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-grpc.js
//
// This starts a simple gRPC server, makes a requests to it, then stops the
// server. This is to test `@grpc/grpc-js` instrumentation.
// Adapted from https://github.com/grpc/grpc-node/blob/master/examples/helloworld/dynamic_codegen

const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '/use-grpc.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition).helloworld;

function sayHello(call, callback) {
    callback(null, {message: 'Hello ' + call.request.name});
}

function main() {
    const server = new grpc.Server();
    server.addService(proto.Greeter.service, {sayHello});

    server.bindAsync(
        '127.0.0.1:0',
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
            if (err) {
                throw err;
            }
            const client = new proto.Greeter(
                `127.0.0.1:${port}`,
                grpc.credentials.createInsecure()
            );
            client.sayHello({name: 'Bob'}, (err, res) => {
                if (err) {
                    throw err;
                }
                console.log('client response:', res);
                server.forceShutdown();
            });
        }
    );
}

main();
