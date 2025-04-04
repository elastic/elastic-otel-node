/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {satisfies} = require('semver');
const test = require('tape');

const {
    filterOutDnsNetSpans,
    runTestFixtures,
    filterOutGcpDetectorSpans,
} = require('./testutils');

function getNodeVerRangeForCurrUndici() {
    const undiciVer = require('undici/package.json').version;
    if (satisfies(undiciVer, '>=6.13.0')) {
        // See discussion at https://github.com/nodejs/undici/issues/3123
        return '>=18.17.0';
    } else if (satisfies(undiciVer, '>=6.0.0')) {
        return '>=18.0.0';
    } else if (satisfies(undiciVer, '>=5.28.0')) {
        return '>=14.18.0';
    }
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-undici-request.js',
        versionRanges: {
            node: getNodeVerRangeForCurrUndici(),
        },
        args: ['./fixtures/use-undici-request.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const spans = filterOutGcpDetectorSpans(
                filterOutDnsNetSpans(col.sortedSpans)
            );
            t.equal(spans.length, 1);
            const span = spans[0];
            t.equal(span.scope.name, '@opentelemetry/instrumentation-undici');
            t.equal(span.name, 'GET');
            t.equal(span.kind, 'SPAN_KIND_CLIENT');
            t.equal(span.attributes['http.request.method'], 'GET');
            t.equal(span.attributes['url.full'], 'http://www.google.com/');
        },
    },
    {
        name: 'use-fetch.js (CommonJS)',
        versionRanges: {
            node: '>=18.0.0', // when `fetch()` was added
        },
        args: ['./fixtures/use-fetch.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const spans = filterOutGcpDetectorSpans(col.sortedSpans);
            t.equal(spans.length, 1);
            const span = spans[0];
            t.equal(span.scope.name, '@opentelemetry/instrumentation-undici');
            t.equal(span.name, 'GET');
            t.equal(span.kind, 'SPAN_KIND_CLIENT');
            t.equal(span.attributes['http.request.method'], 'GET');
            t.equal(span.attributes['url.full'], 'http://www.google.com/');
        },
    },
    {
        name: 'use-fetch.mjs (ESM)',
        versionRanges: {
            // This does not depend on `module.register()` that was added in
            // later Node.js versions, because undici is instrumented via
            // diagnostic channels.
            node: '>=18.0.0', // when `fetch()` was added
        },
        args: ['./fixtures/use-fetch.mjs'],
        cwd: __dirname,
        env: {
            // Typically '--import' usage is required for ESM instrumention.
            // However undici instrumentation uses diagnostics_channel, so it
            // is an exception.
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const spans = filterOutGcpDetectorSpans(col.sortedSpans);
            t.equal(spans.length, 1);
            const span = spans[0];
            t.equal(span.scope.name, '@opentelemetry/instrumentation-undici');
            t.equal(span.name, 'GET');
            t.equal(span.kind, 'SPAN_KIND_CLIENT');
            t.equal(span.attributes['http.request.method'], 'GET');
            t.equal(span.attributes['url.full'], 'http://www.google.com/');
        },
    },
];

test('undici instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
