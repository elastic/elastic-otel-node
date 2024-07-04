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

// Test the *native* OTel instrumentation for `@elastic/elasticsearch` 8.15.0
// and later.

const test = require('tape');
const {filterOutDnsNetSpans, runTestFixtures} = require('./testutils');

const skip = process.env.ES_URL === undefined;
if (skip) {
    console.log(
        '# SKIP elasticsearch tests: ES_URL is not set (try with `ES_URL=http://localhost:9200`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-elasticsearch.js (CommonJS)',
        args: ['./fixtures/use-elasticsearch.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // Expected a trace like this:
            // XXX
            const spans = filterOutDnsNetSpans(col.sortedSpans);
            console.log('XXX spans: ', spans);
            // t.equal(spans.length, 6);
            // spans.slice(1).forEach((s) => {
            //     t.equal(s.traceId, spans[0].traceId, 'traceId');
            //     t.equal(s.parentSpanId, spans[0].spanId, 'parentSpanId');
            //     t.equal(s.kind, 'SPAN_KIND_CLIENT', 'kind');
            //     t.equal(s.scope.name, '@elastic/transport');
            //     t.equal(s.attributes['db.system'], 'elasticsearch');
            // });
        },
    },
];

test('elasticsearch instrumentation', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
