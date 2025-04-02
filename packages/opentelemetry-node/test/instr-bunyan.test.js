/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that 'bunyan' instrumentation generates the telemetry we expect.

const test = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-bunyan (default config)',
        args: ['./fixtures/use-bunyan.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect telemetry to *not* have logs by default (see
            // ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING).
            const spans = col.sortedSpans;
            t.equal(spans.length, 1);
            t.equal(spans[0].name, 'manual-span');
            t.equal(col.logs.length, 0);
        },
    },
    {
        name: 'use-bunyan (ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING=true)',
        args: ['./fixtures/use-bunyan.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // We expect telemetry like this:
            //     ------ logs (2 records) ------
            //     [2024-03-20T23:44:04.857999756Z] info/9 (): hi
            //         name: 'use-bunyan',
            //         foo: 'bar'
            //     [2024-03-20T23:44:04.861000000Z] info/9 (traceId=153156, spanId=9ec413): with span info
            //         name: 'use-bunyan'
            //     ------ trace 153156 (1 span) ------
            //         span 9ec413 "manual-span" (0.8ms, SPAN_KIND_INTERNAL)
            const spans = col.sortedSpans;
            const logs = col.logs;
            t.equal(spans.length, 1);
            t.equal(logs.length, 2);

            t.equal(logs[0].severityText, 'info');
            t.equal(logs[0].body, 'hi');
            t.deepEqual(logs[0].attributes, {name: 'use-bunyan', foo: 'bar'});
            t.equal(
                logs[0].scope.name,
                '@opentelemetry/instrumentation-bunyan'
            );

            t.equal(logs[1].severityText, 'info');
            t.equal(logs[1].body, 'with span info');
            t.equal(logs[1].traceId, spans[0].traceId);
            t.equal(logs[1].spanId, spans[0].spanId);
        },
    },

    // TODO: when we have a supported "bootstrap via code" (see coming
    // `startNodeSDK()` work), then add a test case that uses
    // `getInstrumentations()` for bootstrapping with `disableLogSending: false`
    // winning to enable log sending.
];

test('bunyan instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
