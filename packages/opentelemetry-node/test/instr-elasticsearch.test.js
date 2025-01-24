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

function checkTelemetry(t, col) {
    // Expected a trace like this:
    //        span 91a6b1 "search" (13.4ms, SPAN_KIND_CLIENT, GET http://localhost:9200/)
    //   +2ms `- span 14278c "GET" (10.8ms, SPAN_KIND_CLIENT, GET http://localhost:9200/_search?q=pants -> 200)
    const spans = filterOutDnsNetSpans(col.sortedSpans);
    t.equal(spans.length, 2);
    t.equal(spans[0].name, 'search');
    t.equal(spans[0].kind, 'SPAN_KIND_CLIENT', 'kind');
    t.equal(spans[0].scope.name, '@elastic/transport');
    t.equal(spans[0].attributes['db.system'], 'elasticsearch');
    t.equal(spans[0].attributes['db.operation.name'], 'search');

    t.equal(spans[1].traceId, spans[0].traceId, 'traceId');
    t.equal(spans[1].parentSpanId, spans[0].spanId, 'parentSpanId');
    t.equal(spans[1].kind, 'SPAN_KIND_CLIENT', 'kind');
    t.equal(spans[1].scope.name, '@opentelemetry/instrumentation-undici');
    t.equal(spans[1].attributes['http.request.method'], 'GET');
    t.equal(spans[1].attributes['url.path'], '/_search');
    t.equal(spans[1].attributes['url.query'], '?q=pants');
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
        versionRanges: {
            // Min-supported node by @elastic/elasticsearch@8.15.0.
            node: '>=18',
        },
        // verbose: true,
        checkTelemetry,
    },
    {
        name: 'use-elasticsearch.mjs (ESM)',
        args: ['./fixtures/use-elasticsearch.mjs'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
        },
        versionRanges: {
            // Min-supported node by @elastic/elasticsearch@8.15.0.
            node: '>=18',
        },
        // verbose: true,
        checkTelemetry,
    },
];

test('elasticsearch instrumentation', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
