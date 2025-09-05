/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that the 'User-Agent' in exporter requests is set to include to
// mention EDOT Node.js.

const test = require('tape');
const {runTestFixtures} = require('./testutils');

const otlpProtocols = ['http/protobuf', 'http/json', 'grpc'];

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = otlpProtocols.map((otlpProtocol) => {
    return {
        name: otlpProtocol,
        otlpProtocol,

        args: ['./fixtures/use-all-the-signals.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            t.ok(col.rawRequests.length > 1);
            col.rawRequests.forEach((req) => {
                switch (req.transport) {
                    case 'http':
                        t.ok(
                            req.headers['user-agent'].includes(
                                'elastic-otlp-http-javascript/'
                            ),
                            'User-Agent header includes EDOT Node.js string'
                        );
                        break;

                    case 'grpc':
                        // TODO: assert this when user-agent override for gRPC is implemented
                        t.skip(
                            req.metadata
                                .get('user-agent')
                                .includes('elastic-otlp-grpc-javascript/'),
                            'User-Agent header includes EDOT Node.js string'
                        );
                        break;
                }
            });
        },
    };
});

test('User-Agent', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
