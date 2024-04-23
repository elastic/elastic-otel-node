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

const test = require('tape');
const {runTestFixtures} = require('./testutils');

const skip = process.env.MSSQL_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP pg tests: MSSQL_HOST is not set (try with `MSSQL_HOST=localhost`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-tedious',
        args: ['./fixtures/use-tedious.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // Expected a trace like this:
            // ------ trace d1755e (2 spans) ------
            //           span 6bb8d8 "manual-parent-span" (54.3ms, SPAN_KIND_INTERNAL)
            //  +51ms `- span fb837e "execSql master" (3.0ms, SPAN_KIND_CLIENT)
            const spans = col.sortedSpans;
            t.equal(spans.length, 2);
            
            const s = spans.pop();
            t.equal(s.traceId, spans[0].traceId, 'traceId');
            t.equal(s.parentSpanId, spans[0].spanId, 'parentSpanId');
            t.equal(s.kind, 'SPAN_KIND_CLIENT', 'kind');
            t.equal(s.scope.name, '@opentelemetry/instrumentation-tedious');
            t.equal(s.attributes['db.system'], 'mssql');
            t.equal(s.name, 'execSql master');
        },
    },
];

test('tedious instrumentation', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
