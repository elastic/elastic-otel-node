/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('tape');
const {MockOpAMPServer} = require('@elastic/mockopampserver');

const {filterOutDnsNetSpans, runTestFixtures} = require('./testutils');

test('central-config', (suite) => {
    let opampServer = new MockOpAMPServer({
        logLevel: 'warn', // use 'debug' for some debugging of the server
        // logLevel: 'debug',
        hostname: '127.0.0.1',
        port: 0,
        // Tests below require the OpAMP server to be in test mode.
        testMode: true,
    });

    suite.test('setup: MockOpAMPServer', async (t) => {
        await opampServer.start();
    });

    /** @type {import('./testutils').TestFixture[]} */
    const testFixtures = [
        // See the block comment in exercise-central-config.js for how this
        // test case is meant to work.
        {
            name: 'logging_level',
            args: ['./fixtures/exercise-central-config.js'],
            cwd: __dirname,
            env: () => {
                return {
                    NODE_OPTIONS: '--import @elastic/opentelemetry-node',
                    ELASTIC_OTEL_OPAMP_ENDPOINT: opampServer.endpoint,
                    ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL: '300',
                    ELASTIC_OTEL_TEST_OPAMP_CLIENT_DIAG_ENABLED: 'true',
                };
            },
            // verbose: true,
            checkResult: (t, err, stdout, _stderr) => {
                t.error(err, `exited successfully: err=${err}`);

                let msg =
                    'central-config: set \\"logging_level\\" to \\"debug\\"';
                let idx = stdout.indexOf(msg);
                t.ok(idx !== -1, `'${msg}' is in stdout`);

                msg = 'central-config: reset \\"logging_level\\" to \\"info\\"';
                idx = stdout.indexOf(msg, idx + 1);
                t.ok(idx !== -1, `'${msg}' is in stdout`);
            },
            checkTelemetry: (t, col) => {
                let spans = filterOutDnsNetSpans(col.sortedSpans);

                // Expect the client->server spans for the "local" http server.
                const s0 = spans.shift();
                const s1 = spans.shift();
                t.equal(s0.name, 'GET');
                t.equal(s0.kind, 'SPAN_KIND_CLIENT');
                t.equal(s0.attributes['url.path'], '/');
                t.equal(s1.name, 'GET');
                t.equal(s1.kind, 'SPAN_KIND_SERVER');
                t.equal(s1.attributes['url.path'], '/');
                t.equal(s1.parentSpanId, s0.spanId);

                // Drop the expected `http://127.0.0.1:$port/api/agentConfigMap`
                // API calls made to the OpAMP server by the script.
                spans = spans.filter((s) => {
                    if (
                        s.attributes['url.full']?.endsWith(
                            '/api/agentConfigMap'
                        )
                    ) {
                        return false;
                    }
                    return true;
                });

                // Should not be any other spans, e.g. for the OpAMP client
                // communication.
                const unexpectedSpans = spans.map((s) => {
                    return {
                        name: s.name,
                        kind: s.kind,
                        attributes: {
                            'url.full': s.attributes['url.full'],
                            'http.response.status_code':
                                s.attributes['http.response.status_code'],
                        },
                    };
                });
                t.equal(
                    spans.length,
                    0,
                    'no unexpected spans: ' + JSON.stringify(unexpectedSpans)
                );
            },
        },
    ];
    runTestFixtures(suite, testFixtures);

    suite.test('teardown: MockOpAMPServer', async (t) => {
        await opampServer.close();
    });

    suite.end();
});
