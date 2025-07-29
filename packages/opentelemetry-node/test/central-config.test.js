/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('tape');
const {MockOpAMPServer} = require('@elastic/mockopampserver');

const {
    filterOutDnsNetSpans,
    findObjInArray,
    runTestFixtures,
    findObjsInArray,
} = require('./testutils');
const luggite = require('../lib/luggite');

/**
 * Assert expected telemetry from having run `central-config-gen-telemetry.js`.
 */
function assertCentralConfigGenTelemetry(
    t,
    col,
    expectations = [],
    metricsAfterNs = undefined
) {
    // Expected trace (when all instrs are enabled):
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
            if (s1) {
                t.equal(
                    s2.parentSpanId,
                    s1.spanId,
                    'http server span is child of undici client span'
                );
            }
        }
    }
    t.equal(
        spans.length,
        0,
        `no unexpected extra spans: ${JSON.stringify(spans)}`
    );

    // Check for expected metrics.
    // When doing negative tests, i.e. ensuring that a metric is *not* reported,
    // we need to only consider metrics collected *after* central-config
    // changes were applied. The most reliable way to do this is by passing in
    // `metricsAfterNs` -- this exclude metrics collected before this time.
    const metricsOpts = metricsAfterNs
        ? {afterUnixNano: metricsAfterNs}
        : {lastBatch: true};
    let metrics = col.metrics(metricsOpts);
    if (expectations.includes('metrics')) {
        if (expectations.includes('instr-runtime-node')) {
            t.ok(
                findObjInArray(metrics, 'name', 'nodejs.eventloop.utilization'),
                'instr-runtime-node metric'
            );
        } else {
            t.ok(
                !findObjInArray(
                    metrics,
                    'name',
                    'nodejs.eventloop.utilization'
                ),
                'no instr-runtime-node metrics'
            );
        }
        if (expectations.includes('instr-undici')) {
            t.ok(
                findObjInArray(
                    metrics,
                    'scope.name',
                    '@opentelemetry/instrumentation-undici'
                ),
                'instr-undici metric'
            );
        } else {
            t.ok(
                !findObjInArray(
                    metrics,
                    'scope.name',
                    '@opentelemetry/instrumentation-undici'
                ),
                'no instr-undici metrics'
            );
        }
        if (expectations.includes('instr-http')) {
            t.ok(
                findObjInArray(metrics, 'name', 'http.server.request.duration'),
                'instr-http metric'
            );
        } else {
            t.ok(
                !findObjInArray(
                    metrics,
                    'name',
                    'http.server.request.duration'
                ),
                'no instr-http metrics'
            );
        }
    } else {
        t.equal(
            metrics.length,
            0,
            `no unexpected metrics: ${JSON.stringify(metrics)}`
        );
    }

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
    var testFixtures = [
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

                const recs = stdout
                    .split(/\r?\n/g)
                    .filter((ln) => ln.startsWith('{'))
                    .map((ln) => JSON.parse(ln));

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
                let spans = col.sortedSpans.filter((s) => {
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
        // undici, and pino (covering all 3 telemetry signals).
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
                OTEL_NODE_RESOURCE_DETECTORS:
                    'env,host,os,process,serviceinstance,container',
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
                    OTEL_NODE_RESOURCE_DETECTORS:
                        'env,host,os,process,serviceinstance,container',
                    // Configure OpAMP usage for testing.
                    ELASTIC_OTEL_OPAMP_ENDPOINT: opampServer.endpoint,
                    ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL: '300',
                    ELASTIC_OTEL_TEST_OPAMP_CLIENT_DIAG_ENABLED: 'true',
                    // Set a short metric export interval to allow the
                    // fixture script to wait for an interval after receiving
                    // central config before proceeding.
                    OTEL_METRIC_EXPORT_INTERVAL: '500',
                    OTEL_METRIC_EXPORT_TIMEOUT: '450',
                };
            },
            before: () => {
                const config = {
                    deactivate_all_instrumentations: 'true',
                };
                opampServer.setAgentConfigMap({
                    configMap: {
                        elastic: {
                            body: Buffer.from(JSON.stringify(config), 'utf8'),
                            contentType: 'application/json',
                        },
                    },
                });
            },
            after: () => {
                opampServer.setAgentConfigMap({configMap: {}});
            },
            verbose: true,
            checkResult: (t, err, stdout, _stderr) => {
                t.error(err, `exited successfully: err=${err}`);
                const recs = stdout
                    .split(/\r?\n/g)
                    .filter((ln) => ln.startsWith('{'))
                    .map((ln) => JSON.parse(ln));
                const pinoRec = findObjInArray(recs, 'msg', 'hi at info level');
                t.ok(pinoRec);
                t.notOk(
                    pinoRec.trace_id || pinoRec.span_id,
                    'pino log record does not have logCorrelation fields'
                );
            },
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

        {
            name: 'central-config: deactivate_instrumentations=undici,runtime-node',
            args: ['./fixtures/central-config-gen-telemetry.js'],
            cwd: __dirname,
            env: () => {
                return {
                    NODE_OPTIONS: '--import @elastic/opentelemetry-node',
                    ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
                    // Skip cloud resource detectors to avoid delay and noise.
                    OTEL_NODE_RESOURCE_DETECTORS:
                        'env,host,os,process,serviceinstance,container',
                    ELASTIC_OTEL_OPAMP_ENDPOINT: opampServer.endpoint,
                    ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL: '300',
                    ELASTIC_OTEL_TEST_OPAMP_CLIENT_DIAG_ENABLED: 'true',
                    // Set a short metric export interval to allow the
                    // fixture script to wait for an interval after receiving
                    // central config before proceeding.
                    OTEL_METRIC_EXPORT_INTERVAL: '500',
                    OTEL_METRIC_EXPORT_TIMEOUT: '450',
                };
            },
            before: () => {
                const config = {
                    deactivate_instrumentations: 'undici, runtime-node',
                };
                opampServer.setAgentConfigMap({
                    configMap: {
                        elastic: {
                            body: Buffer.from(JSON.stringify(config), 'utf8'),
                            contentType: 'application/json',
                        },
                    },
                });
            },
            after: () => {
                opampServer.setAgentConfigMap({configMap: {}});
            },
            verbose: true,
            checkTelemetry: (t, col, stdout) => {
                const ccAppliedRe = /^CENTRAL_CONFIG_APPLIED: (\d+)$/m;
                const ccAppliedStr = ccAppliedRe.exec(stdout)[1];
                const ccAppliedNs = BigInt(ccAppliedStr) * 1000000n;
                assertCentralConfigGenTelemetry(
                    t,
                    col,
                    [
                        'spans',
                        'metrics',
                        'logs',
                        // 'instr-runtime-node',
                        // 'instr-undici',
                        'instr-http',
                    ],
                    ccAppliedNs
                );
            },
        },

        // This is an attempt at an exhaustive test that
        // `deactivate_all_instrumentations` works as expected for *every*
        // instrumentation -- or at least every one that we've managed to add a
        // test for here.
        {
            name: 'central-config: deactivate_all_instrumentations on all the things',
            args: ['./fixtures/central-config-use-all-the-things.js'],
            skip: () => {
                // https://github.com/elastic/elastic-otel-node/blob/main/packages/opentelemetry-node/TESTING.md#requirements-for-writing-test-files
                const missingEnvVars = ['MONGODB_HOST'].filter(
                    (k) => !process.env[k]
                );
                if (missingEnvVars.length > 0) {
                    return 'missing envvars ' + missingEnvVars.join(', ');
                }
            },
            cwd: __dirname,
            env: () => {
                return {
                    NODE_OPTIONS: '--import @elastic/opentelemetry-node',
                    ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
                    // Skip cloud resource detectors to avoid delay and noise.
                    OTEL_NODE_RESOURCE_DETECTORS:
                        'env,host,os,process,serviceinstance,container',
                    // Configure OpAMP usage for testing.
                    ELASTIC_OTEL_OPAMP_ENDPOINT: opampServer.endpoint,
                    ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL: '300',
                    ELASTIC_OTEL_TEST_OPAMP_CLIENT_DIAG_ENABLED: 'true',
                    // Set a short metric export interval to allow the
                    // fixture script to wait for an interval after receiving
                    // central config before proceeding.
                    OTEL_METRIC_EXPORT_INTERVAL: '500',
                    OTEL_METRIC_EXPORT_TIMEOUT: '450',
                };
            },
            verbose: true,
            checkTelemetry: (t, col) => {
                const spans = filterOutDnsNetSpans(col.sortedSpans);
                const allMetrics = col.metrics();
                const lastMetrics = col.metrics({lastBatch: true});

                // --- Phase A: baseline check on expected telemetry from instrs.
                t.comment('phase A');
                const a = findObjInArray(spans, 'name', 'a');
                const aChildren = findObjsInArray(
                    spans,
                    'parentSpanId',
                    a.spanId
                );
                t.equal(aChildren.length, 3, 'expected num children of "a"');
                let span, metric;

                // pg
                t.ok(
                    findObjInArray(
                        aChildren,
                        'name',
                        'pg.query:SELECT postgres'
                    ),
                    'pg span'
                );
                metric = findObjInArray(
                    allMetrics,
                    'scope.name',
                    '@opentelemetry/instrumentation-pg'
                );
                t.equal(
                    metric.name,
                    'db.client.operation.duration',
                    'pg metric'
                );

                // http.get
                span = findObjInArray(
                    aChildren,
                    'scope.name',
                    '@opentelemetry/instrumentation-http'
                );
                t.equal(span.name, 'GET', 'http.get span');
                metric = findObjInArray(
                    allMetrics,
                    'scope.name',
                    '@opentelemetry/instrumentation-http'
                );
                t.equal(
                    metric.name,
                    'http.client.request.duration',
                    'http.get metric'
                );

                // mongodb
                span = findObjInArray(
                    aChildren,
                    'scope.name',
                    '@opentelemetry/instrumentation-mongodb'
                );
                t.equal(span.name, 'mongodb.insert', 'mongodb span');
                metric = findObjInArray(
                    allMetrics,
                    'scope.name',
                    '@opentelemetry/instrumentation-mongodb'
                );
                t.equal(
                    metric.name,
                    'db.client.connections.usage',
                    'mongodb metric'
                );

                // --- Phase B: should not see telemetry from phase B.
                t.comment('phase B');
                const b = findObjInArray(spans, 'name', 'b');
                const bChildren = findObjsInArray(
                    spans,
                    'parentSpanId',
                    b.spanId
                );
                t.equal(bChildren.length, 0, 'expected num children of "b"');
                t.notOk(
                    findObjInArray(
                        lastMetrics,
                        'scope.name',
                        '@opentelemetry/instrumentation-pg'
                    ),
                    'no pg metrics'
                );
                // Limitations:
                // - The current technique for disabling instr-http is
                //   insufficient to disable its client metrics when client code
                //   has a ref to the previously patched export via:
                //      const {get, request} = require('http');
                //   So we cannot make this assertion:
                //      t.notOk(findObjInArray(allMetrics, 'scope.name', '@opentelemetry/instrumentation-http'), 'no http metrics');
                // - Cannot disable metrics for instr-mongodb.
            },
        },

        // TODO: Test unpatching cases with ESM. Does that work?
    ];

    // Dev Note: use DEV_TEST_FILTER envvar to limit to a subset of fixtures.
    if (process.env.DEV_TEST_FILTER) {
        testFixtures = testFixtures.filter((tf) =>
            tf.name.includes(process.env.DEV_TEST_FILTER)
        );
        suite.ok(
            testFixtures.length > 0,
            'DEV_TEST_FILTER should not result in an *empty* `testFixtures`'
        );
        suite.comment(
            `Filtering "testFixtures" with DEV_TEST_FILTER="${process.env.DEV_TEST_FILTER}"`
        );
    }

    runTestFixtures(suite, testFixtures);

    suite.test('teardown: MockOpAMPServer', async (t) => {
        await opampServer.close();
    });

    suite.end();
});
