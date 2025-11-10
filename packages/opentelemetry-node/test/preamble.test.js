/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// EDOT Node.js logs a preamble message at startup. This test file ensures
// that preamble includes the intended data.

const {test} = require('tape');
const {runTestFixtures, findObjInArray} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'premable basic',
        args: ['./fixtures/use-express.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_METRICS_EXPORTER: 'none',
            OTEL_EXPORTER_OTLP_HEADERS: 'Foo=bar',
            ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING: 'true',
        },
        verbose: true,
        checkTelemetry: (t, col, stdout) => {
            const logs = stdout
                .split(/\r?\n/g)
                .filter((ln) => ln.startsWith('{'))
                .map((ln) => JSON.parse(ln));
            const preamble = findObjInArray(logs, 'preamble', true);
            t.ok(preamble);
            t.ok(preamble.system.os);
            t.ok(preamble.system.runtime);
            t.strictEqual(preamble.level, 30, 'premable logged at INFO level');
            t.strictEqual(preamble.edotEnv.OTEL_METRICS_EXPORTER, 'none');
            t.strictEqual(
                preamble.edotEnv.ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING,
                'true'
            );
            t.strictEqual(
                preamble.edotEnv.OTEL_EXPORTER_OTLP_HEADERS,
                '[REDACTED]'
            );
        },
    },
];

test('preamble log.info', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
