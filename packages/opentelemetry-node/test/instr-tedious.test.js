/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('tape');
const semver = require('semver');
const {filterOutDnsNetSpans, runTestFixtures} = require('./testutils');

const tediousVer = require('tedious/package.json').version;
let skip = process.env.MSSQL_HOST === undefined;

if (skip) {
    console.log(
        '# SKIP pg tests: MSSQL_HOST is not set (try with `MSSQL_HOST=localhost`)'
    );
}

if (
    (semver.gte(tediousVer, '17.0.0') &&
        semver.lt(process.version, '18.0.0')) ||
    // tedious@11 and later depend on @azure/identity v1 or v2. As of
    // @azure/core-rest-pipeline@1.15.0 (a dep of @azure/identity), support for
    // Node.js <16 has been broken.
    (semver.gte(tediousVer, '11.0.0') && semver.lt(process.version, '16.0.0'))
) {
    console.log(
        `# SKIP tedious@${tediousVer} does not support node ${process.version}`
    );
    skip = true;
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
            const spans = filterOutDnsNetSpans(col.sortedSpans);
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
