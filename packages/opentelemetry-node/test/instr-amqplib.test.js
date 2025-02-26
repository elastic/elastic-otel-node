/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('tape');
const {filterOutDnsNetSpans, runTestFixtures} = require('./testutils');

const skip = process.env.RABBITMQ_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP amqplib tests: RABBITMQ_HOST is not set (try with `RABBITMQ_HOST=localhost`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-amqplib.js',
        args: ['./fixtures/use-amqplib.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // Expected a trace like this:
            // ------ trace ce800e (2 spans) ------
            //        span a2ee5c "publish <default>" (1.0ms, SPAN_KIND_PRODUCER)
            //   +3ms `- span 3d9535 "edot-test process" (4.6ms, STATUS_CODE_ERROR, SPAN_KIND_CONSUMER)

            const spans = filterOutDnsNetSpans(col.sortedSpans);
            t.equal(spans.length, 2);
            spans.forEach((s) => {
                t.equal(s.scope.name, '@opentelemetry/instrumentation-amqplib');
            });
            t.equal(spans[0].traceId, spans[1].traceId, 'traceId');

            t.equal(spans[0].kind, 'SPAN_KIND_PRODUCER', 'kind');
            t.equal(spans[0].name, 'publish <default>');
            t.equal(spans[1].kind, 'SPAN_KIND_CONSUMER', 'kind');
            t.equal(spans[1].name, 'edot-test process');
        },
    },
];

test('amqplib instrumentation', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
