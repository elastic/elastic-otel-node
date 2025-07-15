/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('tape');
const {MockOpAMPServer} = require('@elastic/mockopampserver');

const {filterOutDnsNetSpans, findObjInArray, runTestFixtures} = require('./testutils');
const luggite = require('../lib/luggite');


/**
 * Assert expected telemetry from having run `central-config-gen-telemetry.js`.
 */
function assertCentralConfigGenTelemetry(t, col, expectations = []) {
    // Expected trace:
    //  span 53aa39 "manual-span" (SPAN_KIND_INTERNAL, scope=test)
    //  `- span 2c466b "GET" (SPAN_KIND_CLIENT, scope=undici)
    //    `- span 5a94ec "GET" (SPAN_KIND_SERVER, scope=http)
    let spans = filterOutDnsNetSpans(col.sortedSpans);
    let s0, s1, s2;
    if (expectations.includes('spans')) {
        s0 = spans.shift();
        t.equal(s0.name, 'manual-span', 'manual-span');
        t.equal(s0.kind, 'SPAN_KIND_INTERNAL');
        if (expectations.includes('instr-undici')) {
            s1 = spans.shift();
            t.equal(s1.name, 'GET', 'undici span');
            t.equal(s1.kind, 'SPAN_KIND_CLIENT');
            t.equal(s1.attributes['url.path'], '/');
            t.equal(s1.parentSpanId, s0.spanId);
        }
        if (expectations.includes('instr-http')) {
            s2 = spans.shift();
            t.equal(s2.name, 'GET', 'http server span');
            t.equal(s2.kind, 'SPAN_KIND_SERVER');
            t.equal(s2.attributes['url.path'], '/');
            t.equal(s2.parentSpanId, s1?.spanId || s0.spanId);
        }
    }
    t.equal(spans.length, 0, `no unexpected extra spans: ${JSON.stringify(spans)}`);

    // TODO: cannot yet test metrics, because disabling metrics from some instrs is not yet implemented.
    //
    // // Check for a subset of expected metrics.
    // let metrics = col.metrics;
    // if (expectations.includes('metrics')) {
    //     t.ok(findObjInArray(metrics, 'name', 'process.cpu.utilization'), 'host-metrics metric');
    //     if (expectations.includes('instr-runtime-node')) {
    //         t.ok(findObjInArray(metrics, 'name', 'nodejs.eventloop.utilization'), 'instr-runtime-node metric');
    //     } else {
    //         t.ok(!findObjInArray(metrics, 'name', 'nodejs.eventloop.utilization'), 'no instr-runtime-node metrics');
    //     }
    //     if (expectations.includes('instr-undici')) {
    //         t.ok(findObjInArray(metrics, 'name', 'http.client.request.duration'), 'instr-undici metric');
    //     } else {
    //         t.ok(!findObjInArray(metrics, 'name', 'http.client.request.duration'), 'no instr-undici metrics');
    //     }
    //     if (expectations.includes('instr-http')) {
    //         t.ok(findObjInArray(metrics, 'name', 'http.server.request.duration'), 'instr-http metric');
    //     } else {
    //         t.ok(!findObjInArray(metrics, 'name', 'http.server.request.duration'), 'no instr-http metrics');
    //     }
    // } else {
    //     t.equal(metrics.length, 0, `no unexpected metrics: ${JSON.stringify(metrics)}`);
    // }

    let logs = col.logs;
    let rec;
    if (expectations.includes('logs')) {
        rec = logs.shift();
        t.equal(rec.body, 'hi at info level', 'info-level log record');
        t.equal(rec.severityText, 'info');
        if (s0) t.equal(rec.spanId, s0.spanId);
    }
    t.equal(logs.length, 0, `no unexpected app logs: ${JSON.stringify(logs)}`);
}

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
        {
            name: 'logging_level',
            args: ['./fixtures/central-config-logging-level.js'],
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

                const recs = stdout.split(/\r?\n/g)
                    .filter(ln => ln.startsWith('{'))
                    .map(ln => JSON.parse(ln));

                // Check that the `diag.*` calls worked as expected.
                t.ok(!findObjInArray(recs, 'msg', 'verbose1'));
                t.ok(!findObjInArray(recs, 'msg', 'debug1'));
                t.ok(findObjInArray(recs, 'msg', 'info1'));
                t.ok(findObjInArray(recs, 'msg', 'warn1'));
                t.ok(findObjInArray(recs, 'msg', 'error1'));

                t.ok(!findObjInArray(recs, 'msg', 'verbose2'));
                t.ok(findObjInArray(recs, 'msg', 'debug2')); // This is the significant one.
                t.ok(findObjInArray(recs, 'msg', 'info2'));
                t.ok(findObjInArray(recs, 'msg', 'warn2'));
                t.ok(findObjInArray(recs, 'msg', 'error2'));

                t.ok(!findObjInArray(recs, 'msg', 'verbose3'));
                t.ok(!findObjInArray(recs, 'msg', 'debug3'));
                t.ok(findObjInArray(recs, 'msg', 'info3'));
                t.ok(findObjInArray(recs, 'msg', 'warn3'));
                t.ok(findObjInArray(recs, 'msg', 'error3'));

                // Also check for some SDK logging of central-config handling.
                const expectedMsgs = [
                    'central-config: set "logging_level" to "debug"',
                    'central-config: reset "logging_level" to "info"',
                ];
                for (let expectedMsg of expectedMsgs) {
                    const rec = findObjInArray(recs, 'msg', expectedMsg);
                    t.ok(rec, `'${expectedMsg}' is in stdout`);
                    t.equal(rec?.level, luggite.INFO);
                }
            },
            checkTelemetry: (t, col) => {
                // Drop the expected `http://127.0.0.1:$port/api/agentConfigMap`
                // API calls made to the OpAMP server by the script.
                let spans = col.sortedSpans
                    .filter((s) => {
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

        // Use "central-config-gen-telemetry.js" for a few tests. The script
        // will (a) wait for opamp-client events to ensure central config
        // has been received, if any, then (b) execute code that uses http,
        // undici, and pino (generating all telemetry signals).
        //
        // The first test case is a baseline with no central-config. Subsequent
        // tests tweak central-config settings and assert expected differences
        // in received telemetry.
        {
            name: 'central-config-gen-telemetry.js baseline',
            args: ['./fixtures/central-config-gen-telemetry.js'],
            cwd: __dirname,
            env: {
                NODE_OPTIONS: '--import @elastic/opentelemetry-node',
                ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
                // Skip cloud resource detectors to avoid delay and noise.
                OTEL_NODE_RESOURCE_DETECTORS: 'env,host,os,process,serviceinstance,container',
            },
            // verbose: true,
            checkTelemetry: (t, col) => {
                assertCentralConfigGenTelemetry(t, col, [
                    'spans',
                    'metrics',
                    'logs',
                    'instr-runtime-node',
                    'instr-undici',
                    'instr-http',
                ]);
            },
        },

        {
            name: 'central-config: deactivate_all_instrumentations',
            args: ['./fixtures/central-config-gen-telemetry.js'],
            cwd: __dirname,
            env: () => {
                return {
                    NODE_OPTIONS: '--import @elastic/opentelemetry-node',
                    ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
                    // Skip cloud resource detectors to avoid delay and noise.
                    OTEL_NODE_RESOURCE_DETECTORS: 'env,host,os,process,serviceinstance,container',
                    ELASTIC_OTEL_OPAMP_ENDPOINT: opampServer.endpoint,
                    ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL: '300',
                    ELASTIC_OTEL_TEST_OPAMP_CLIENT_DIAG_ENABLED: 'true',
                };
            },
            before: () => {
                const config = {
                    deactivate_all_instrumentations: 'true'
                };
                opampServer.setAgentConfigMap({
                    configMap: {
                        elastic: {
                            body: Buffer.from(JSON.stringify(config), 'utf8'),
                            contentType: 'application/json',
                        }
                    }
                });
            },
            after: () => {
                opampServer.setAgentConfigMap({ configMap: {} });
            },
            verbose: true,
            checkTelemetry: (t, col) => {
                assertCentralConfigGenTelemetry(t, col, [
                    'spans',
                    'metrics',
                    'logs',
                    // Expect these to be deactivated.
                    // 'instr-runtime-node',
                    // 'instr-undici',
                    // 'instr-http',
                ]);
            },
        },

        // TODO: deactivate_instrumentations
        // {
        //     name: 'central-config: deactivate_instrumentations=undici,runtime-node',
        //     args: ['./fixtures/central-config-gen-telemetry.js'],
        //     cwd: __dirname,
        //     env: () => {
        //         return {
        //             NODE_OPTIONS: '--import @elastic/opentelemetry-node',
        //             ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
        //             // Skip cloud resource detectors to avoid delay and noise.
        //             OTEL_NODE_RESOURCE_DETECTORS: 'env,host,os,process,serviceinstance,container',
        //             ELASTIC_OTEL_OPAMP_ENDPOINT: opampServer.endpoint,
        //             ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL: '300',
        //             ELASTIC_OTEL_TEST_OPAMP_CLIENT_DIAG_ENABLED: 'true',
        //         };
        //     },
        //     before: () => {
        //         const config = {
        //             deactivate_instrumentations: 'undici, runtime-node'
        //         };
        //         opampServer.setAgentConfigMap({
        //             configMap: {
        //                 elastic: {
        //                     body: Buffer.from(JSON.stringify(config), 'utf8'),
        //                     contentType: 'application/json',
        //                 }
        //             }
        //         });
        //     },
        //     after: () => {
        //         opampServer.setAgentConfigMap({ configMap: {} });
        //     },
        //     verbose: true,
        //     checkTelemetry: (t, col) => {
        //         assertCentralConfigGenTelemetry(t, col, [
        //             'spans',
        //             'metrics',
        //             'logs',
        //             // 'instr-runtime-node',
        //             // 'instr-undici',
        //             'instr-http',
        //         ]);
        //     },
        // },

        // TODO add subsequent tests that tweak central config deactivate_ et al values.
        // TODO deact pino
        // TODO send_traces
    ];
    runTestFixtures(suite, testFixtures);

    suite.test('teardown: MockOpAMPServer', async (t) => {
        await opampServer.close();
    });

    suite.end();
});
