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
