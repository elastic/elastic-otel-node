/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test `ELASTIC_OTEL_USE_PATH_AS_SPAN_NAME` and `ELASTIC_OTEL_SPAN_NAME_GROUPS`.

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

function spanNames(col) {
    // `use-http-server.js` makes a "GET /" and a "POST /echo" request.
    return col.sortedSpans.map((s) => `${s.kind} ${s.name}`);
}

const USE_SPAN_NAMES_DEFAULT = [
    'SPAN_KIND_SERVER GET',
    'SPAN_KIND_SERVER GET',
    'SPAN_KIND_SERVER GET',
    'SPAN_KIND_SERVER GET',
    'SPAN_KIND_SERVER POST',
    'SPAN_KIND_SERVER PURGE',
    'SPAN_KIND_SERVER HTTP',
    'SPAN_KIND_SERVER GET /users/:id',
    'SPAN_KIND_SERVER DELETE',
    'SPAN_KIND_CLIENT PUT',
    'SPAN_KIND_INTERNAL PUT',
    'SPAN_KIND_INTERNAL process orders-123',
    'SPAN_KIND_INTERNAL x-suffix',
    'SPAN_KIND_INTERNAL aXbYc',
    'SPAN_KIND_INTERNAL acb',
    'SPAN_KIND_INTERNAL abbbb',
    'SPAN_KIND_INTERNAL abbb',
    'SPAN_KIND_INTERNAL lib.[a](b)+^$|\\?x',
    'SPAN_KIND_INTERNAL libX[a](b)+^$|\\?x',
];

const SPAN_NAME_GROUPS = [
    'GET /users/*/cart',
    'GET /orders/*',
    // Case-sensitive, does not match "GET /Users/42".
    'GET /users/*',
    'process orders-*',
    '*-suffix',
    'a*b*c',
    'a*bb*bb',
    // Regular expression metacharacters are literal.
    'lib.[a](b)+^$|\\?*',
].join(',');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'span naming not configured',
        args: ['./fixtures/use-http-server.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        checkTelemetry: (t, col) => {
            t.deepEqual(spanNames(col), [
                'SPAN_KIND_CLIENT GET',
                'SPAN_KIND_SERVER GET',
                'SPAN_KIND_CLIENT POST',
                'SPAN_KIND_SERVER POST',
            ]);
        },
    },
    {
        name: 'ELASTIC_OTEL_USE_PATH_AS_SPAN_NAME=true',
        args: ['./fixtures/use-http-server.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            ELASTIC_OTEL_USE_PATH_AS_SPAN_NAME: 'true',
        },
        checkTelemetry: (t, col) => {
            t.deepEqual(spanNames(col), [
                'SPAN_KIND_CLIENT GET',
                'SPAN_KIND_SERVER GET /',
                'SPAN_KIND_CLIENT POST',
                'SPAN_KIND_SERVER POST /echo',
            ]);
            const server = col.sortedSpans[3];
            t.equal(server.attributes['url.path'], '/echo');
            t.equal(server.parentSpanId, col.sortedSpans[2].spanId);
        },
    },
    {
        name: 'ELASTIC_OTEL_USE_PATH_AS_SPAN_NAME=true, ELASTIC_OTEL_SPAN_NAME_GROUPS',
        args: ['./fixtures/use-http-server.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            ELASTIC_OTEL_USE_PATH_AS_SPAN_NAME: 'true',
            ELASTIC_OTEL_SPAN_NAME_GROUPS: 'POST /e*, GE*',
        },
        checkTelemetry: (t, col) => {
            t.deepEqual(spanNames(col), [
                'SPAN_KIND_CLIENT GE*',
                'SPAN_KIND_SERVER GE*',
                'SPAN_KIND_CLIENT POST',
                'SPAN_KIND_SERVER POST /e*',
            ]);
        },
    },
    {
        name: 'ELASTIC_OTEL_SPAN_NAME_GROUPS only',
        args: ['./fixtures/use-http-server.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            ELASTIC_OTEL_SPAN_NAME_GROUPS: 'P*',
        },
        checkTelemetry: (t, col) => {
            t.deepEqual(spanNames(col), [
                'SPAN_KIND_CLIENT GET',
                'SPAN_KIND_SERVER GET',
                'SPAN_KIND_CLIENT P*',
                'SPAN_KIND_SERVER P*',
            ]);
        },
    },
    {
        name: 'use-span-names.js span naming not configured',
        args: ['./fixtures/use-span-names.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        checkTelemetry: (t, col) => {
            t.deepEqual(spanNames(col), USE_SPAN_NAMES_DEFAULT);
        },
    },
    {
        name: 'use-span-names.js ELASTIC_OTEL_USE_PATH_AS_SPAN_NAME=true',
        args: ['./fixtures/use-span-names.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            ELASTIC_OTEL_USE_PATH_AS_SPAN_NAME: 'true',
        },
        checkTelemetry: (t, col) => {
            const expected = USE_SPAN_NAMES_DEFAULT.slice();
            expected.splice(
                0,
                7,
                'SPAN_KIND_SERVER GET /users/42/cart',
                'SPAN_KIND_SERVER GET /users/73/cart',
                'SPAN_KIND_SERVER GET /orders/1',
                'SPAN_KIND_SERVER GET /Users/42',
                'SPAN_KIND_SERVER POST /users/42/cart',
                'SPAN_KIND_SERVER PURGE /purge',
                'SPAN_KIND_SERVER HTTP /other'
            );
            t.deepEqual(spanNames(col), expected);
        },
    },
    {
        name: 'use-span-names.js ELASTIC_OTEL_USE_PATH_AS_SPAN_NAME=true, ELASTIC_OTEL_SPAN_NAME_GROUPS',
        args: ['./fixtures/use-span-names.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            ELASTIC_OTEL_USE_PATH_AS_SPAN_NAME: 'true',
            ELASTIC_OTEL_SPAN_NAME_GROUPS: SPAN_NAME_GROUPS,
        },
        checkTelemetry: (t, col) => {
            t.deepEqual(spanNames(col), [
                'SPAN_KIND_SERVER GET /users/*/cart',
                'SPAN_KIND_SERVER GET /users/*/cart',
                'SPAN_KIND_SERVER GET /orders/*',
                'SPAN_KIND_SERVER GET /Users/42',
                'SPAN_KIND_SERVER POST /users/42/cart',
                'SPAN_KIND_SERVER PURGE /purge',
                'SPAN_KIND_SERVER HTTP /other',
                // The first matching pattern wins.
                'SPAN_KIND_SERVER GET /users/*',
                'SPAN_KIND_SERVER DELETE',
                'SPAN_KIND_CLIENT PUT',
                'SPAN_KIND_INTERNAL PUT',
                'SPAN_KIND_INTERNAL process orders-*',
                'SPAN_KIND_INTERNAL *-suffix',
                'SPAN_KIND_INTERNAL a*b*c',
                'SPAN_KIND_INTERNAL acb',
                'SPAN_KIND_INTERNAL a*bb*bb',
                'SPAN_KIND_INTERNAL abbb',
                'SPAN_KIND_INTERNAL lib.[a](b)+^$|\\?*',
                'SPAN_KIND_INTERNAL libX[a](b)+^$|\\?x',
            ]);
        },
    },
];

test('ELASTIC_OTEL_USE_PATH_AS_SPAN_NAME', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
