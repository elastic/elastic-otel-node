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

// Test that 'pino' instrumentation generates the telemetry we expect.

const test = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-pino',
        args: ['./fixtures/use-pino.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            OTEL_LOG_LEVEL: 'none',
        },
        // verbose: true,
        checkResult: (t, err, stdout, _stderr) => {
            t.error(err, `exited successfully: err=${err}`);
            // Clumsy pass of stdout info to `checkTelemetry`.
            t.recs = stdout.trim().split(/\n/g).map(JSON.parse);
        },
        checkTelemetry: (t, col) => {
            const recs = t.recs;
            const spans = col.sortedSpans;
            t.equal(spans.length, 1);

            // Check log records to stdout.
            t.equal(recs.length, 2);
            t.equal(recs[0].level, 30 /* pino INFO */);
            t.equal(recs[0].msg, 'hi');
            t.equal(recs[1].level, 30 /* pino INFO */);
            t.equal(recs[1].msg, 'with span info');
            t.equal(recs[1].trace_id, spans[0].traceId);
            t.equal(recs[1].span_id, spans[0].spanId);

            // TODO: instr-pino doesn't yet support log-sending, so we don't
            // yet expect logs sent via OTLP.
            // const logs = col.logs;
            // ...
        },
    },
];

test('pino instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
