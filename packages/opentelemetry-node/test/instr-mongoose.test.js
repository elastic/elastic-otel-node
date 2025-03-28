/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that 'mongoose' instrumentation generates the telemetry we expect.

const test = require('tape');
const {
    filterOutDnsNetSpans,
    filterOutGcpDetectorSpans,
    runTestFixtures,
} = require('./testutils');

let skip = process.env.MONGODB_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP mongodb tests: MONGODB_HOST is not set (try with `MONGODB_HOST=localhost`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-mongoose',
        args: ['./fixtures/use-mongoose.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        versionRanges: {
            // Since `mongoose` has a dependency on `mongodb` we will keep the same version ranges for testing
            // Ref: https://github.com/mongodb/node-mongodb-native/blob/a8370367f7470962a834ddf36f9a6c62621d6345/package.json#L118
            node: '>=16.20.1',
        },
        verbose: true,
        checkTelemetry: (t, col) => {
            // We expect spans like this
            // ------ trace 5527d1 (13 spans) ------
            //         span 58cce4 "manual-parent-span" (39.0ms, SPAN_KIND_INTERNAL)
            //   +2ms `- span 82ec54 "mongodb.create" (7.6ms, SPAN_KIND_CLIENT)
            //   +9ms `- span bda449 "mongodb.createIndexes" (3.9ms, SPAN_KIND_CLIENT)
            //   -8ms `- span a92f92 "mongodb.insert" (12.1ms, SPAN_KIND_CLIENT)
            //  +13ms `- span 5be842 "mongodb.drop" (0.8ms, SPAN_KIND_CLIENT)
            //   +1ms `- span 13d56b "mongodb.endSessions" (0.3ms, SPAN_KIND_CLIENT)
            //  -20ms `- span c4e688 "mongoose.User.save" (18.9ms, SPAN_KIND_CLIENT)
            const spans = filterOutGcpDetectorSpans(
                filterOutDnsNetSpans(col.sortedSpans)
            );
            t.equal(spans.length, 7);

            t.equal(spans[0].name, 'manual-parent-span');
            t.equal(spans[0].kind, 'SPAN_KIND_INTERNAL');

            const mongooseSpans = spans.filter(
                (s) =>
                    s.scope.name === '@opentelemetry/instrumentation-mongoose'
            );
            t.equal(mongooseSpans.length, 1);

            t.equal(mongooseSpans[0].name, 'mongoose.User.save');
            t.equal(mongooseSpans[0].kind, 'SPAN_KIND_CLIENT');
            t.equal(mongooseSpans[0].parentSpanId, spans[0].spanId);
        },
    },
];

test('mongoose instrumentation', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
