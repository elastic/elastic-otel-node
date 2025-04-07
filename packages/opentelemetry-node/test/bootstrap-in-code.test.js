/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test bootstrapping the SDK in code.
// That means using `--import ./some-file.mjs` or `--require ./some-file.cjs`
// rather than the recommended `--import @elastic/opentelemetry-node`.

const {exec} = require('child_process');
const fs = require('fs');
const path = require('path');
const test = require('tape');
const {
    filterOutDnsNetSpans,
    runTestFixtures,
    findObjInArray,
} = require('./testutils');

const skip = process.env.REDIS_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP bootstrap-in-code tests: REDIS_HOST is not set (try with `REDIS_HOST=localhost`)'
    );
}

function assertUseIoredisJsSpans(t, col) {
    const spans = filterOutDnsNetSpans(col.sortedSpans);
    t.equal(spans.length, 6);
    spans.slice(1).forEach((s) => {
        t.equal(s.traceId, spans[0].traceId, 'traceId');
        t.equal(s.parentSpanId, spans[0].spanId, 'parentSpanId');
        t.equal(s.kind, 'SPAN_KIND_CLIENT', 'kind');
        t.equal(s.scope.name, '@opentelemetry/instrumentation-ioredis');
        t.equal(s.attributes['db.system'], 'redis');
    });
    t.equal(spans[1].name, 'set');
    t.equal(spans[2].name, 'get');
    t.equal(spans[3].name, 'hset');
    t.equal(spans[4].name, 'get');
    t.equal(spans[4].status.code, 'STATUS_CODE_ERROR');
    t.equal(spans[5].name, 'quit');
}

function assertUseIoredisMjsSpans(t, col) {
    // Assert that we got the two redis spans expected from 'use-ioredis.mjs'.
    const spans = filterOutDnsNetSpans(col.sortedSpans);
    t.equal(spans[1].name, 'set');
    t.equal(spans[1].attributes['db.system'], 'redis');
    t.equal(spans[2].name, 'get');
}

function assertUseIoredisTsSpans(t, col) {
    // Assert that we got the two redis spans expected from 'use-ioredis.mjs'.
    const spans = filterOutDnsNetSpans(col.sortedSpans);
    t.equal(spans[1].name, 'set');
    t.equal(spans[1].attributes['db.system'], 'redis');
    t.equal(spans[2].name, 'get');
    // Also assert that the custom MySpanProcessor from telemetry-typescript.ts worked.
    spans.forEach((s) => {
        t.equal(s.attributes['MySpanProcessor'], 'was here');
    });
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'minimal bootstrap, CommonJS-only (telemetry-cjs.js)',
        args: ['./fixtures/use-ioredis.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require ./fixtures/telemetry-cjs.js',
        },
        // verbose: true,
        checkTelemetry: assertUseIoredisJsSpans,
    },
    {
        name: 'minimal bootstrap, CommonJS-only (telemetry-cjs.js on CLI)',
        args: [
            '-r',
            './fixtures/telemetry-cjs.js',
            './fixtures/use-ioredis.js',
        ],
        cwd: __dirname,
        // verbose: true,
        checkTelemetry: assertUseIoredisJsSpans,
    },
    {
        name: 'minimal bootstrap, CommonJS-only (telemetry-cjs.cjs)',
        args: ['./fixtures/use-ioredis.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require ./fixtures/telemetry-cjs.cjs',
        },
        // verbose: true,
        checkTelemetry: assertUseIoredisJsSpans,
    },

    {
        name: 'minimal bootstrap, no ESM instr (telemetry-minimal.mjs)',
        args: ['./fixtures/use-ioredis.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import ./fixtures/telemetry-minimal.mjs',
        },
        // verbose: true,
        checkTelemetry: assertUseIoredisJsSpans,
    },

    {
        name: 'starter bootstrap template (telemetry.mjs)',
        args: ['./fixtures/use-ioredis.mjs'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import ./fixtures/telemetry.mjs',
        },
        verbose: true,
        checkTelemetry: assertUseIoredisMjsSpans,
    },

    {
        name: 'bootstrap instr-http config (telemetry-custom.mjs)',
        args: ['./fixtures/use-http-get.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import ./fixtures/telemetry-custom.mjs',
            MY_SERVICE_NAME: 'instr-http-test-service-name',
        },
        // verbose: true,
        checkTelemetry: function (t, col) {
            const s = col.sortedSpans[0];
            t.equal(s.name, 'GET');
            t.equal(s.scope.name, '@opentelemetry/instrumentation-http');
            // This tests that the custom config in "telemetry-custom.mjs" worked.
            t.equal(s.attributes.foo, 'bar');

            // Test that `serviceName` opt to `startNodeSDK` worked.
            t.equal(
                s.resource.attributes['service.name'],
                'instr-http-test-service-name'
            );

            // Test that metrics are basically working when bootstrapping in code.
            const httpDur = findObjInArray(
                col.metrics,
                'name',
                'http.client.request.duration'
            );
            t.ok(httpDur);
            t.ok(httpDur.histogram);
            const nodejsUtil = findObjInArray(
                col.metrics,
                'name',
                'nodejs.eventloop.utilization'
            );
            t.ok(nodejsUtil);
            t.ok(nodejsUtil.gauge);
            const cpuUtil = findObjInArray(
                col.metrics,
                'name',
                'process.cpu.utilization'
            );
            t.ok(cpuUtil);
            t.ok(cpuUtil.gauge);
        },
    },
    {
        name: 'bootstrap instr-bunyan config (telemetry-custom.mjs)',
        args: ['./fixtures/use-bunyan.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import ./fixtures/telemetry-custom.mjs',
        },
        // verbose: true,
        checkTelemetry: function (t, col) {
            // That we get logs shows that `disableLogSending: false` config worked.
            t.equal(col.logs[0].body, 'hi');
            // That this attribute is on the log record shows that `logHook` worked.
            t.equal(col.logs[1].attributes.hello, 'from logHook');
        },
    },

    // TypeScript-related tests.
    {
        name: 'bootstrap with compiled TS (telemetry-typescript.ts -> .js)',
        args: ['./fixtures/an-esm-pkg/build/use-ioredis.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS:
                '--import ./fixtures/an-esm-pkg/build/telemetry-typescript.js',
        },
        // verbose: true,
        checkTelemetry: assertUseIoredisTsSpans,
    },
    {
        name: 'bootstrap with TS and strip-types (telemetry-typescript.ts)',
        args: [
            '--experimental-strip-types',
            './fixtures/an-esm-pkg/use-ioredis.ts',
        ],
        cwd: __dirname,
        env: {
            NODE_OPTIONS:
                '--import ./fixtures/an-esm-pkg/telemetry-typescript.ts',
        },
        versionRanges: {
            node: '>=22.6.0 <23.6.0', // when --experimental-strip-types was added
        },
        // verbose: true,
        checkTelemetry: assertUseIoredisTsSpans,
    },
    {
        name: 'bootstrap with TS (telemetry-typescript.ts)',
        args: ['./fixtures/an-esm-pkg/use-ioredis.ts'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS:
                '--import ./fixtures/an-esm-pkg/telemetry-typescript.ts',
        },
        versionRanges: {
            node: '>=23.6.0', // when --experimental-strip-types was unflagged
        },
        // verbose: true,
        checkTelemetry: assertUseIoredisTsSpans,
    },
];

// We need to do some install/build for "fixtures/an-esm-pkg/...".
// Limitation:
// - Ideally this would do `make`-like mtime-based checking. May need to
//   `rm -rf fixtures/an-esm-pkg/build` if source files in the package were
//   edited.
const tsFixtureDir = path.join(__dirname, 'fixtures', 'an-esm-pkg');
const haveBuild = fs.existsSync(
    path.join(tsFixtureDir, 'build', 'use-ioredis.js')
);
const cmd = 'npm install && npm run compile';
test(`setup: ${cmd} (in ${tsFixtureDir})`, {skip: haveBuild}, (t) => {
    const startTime = Date.now();
    exec(
        cmd,
        {
            cwd: tsFixtureDir,
        },
        function (err, stdout, stderr) {
            t.error(
                err,
                `"${cmd}" succeeded (took ${(Date.now() - startTime) / 1000}s)`
            );
            if (err) {
                t.comment(
                    `$ ${cmd}\n-- stdout --\n${stdout}\n-- stderr --\n${stderr}\n--`
                );
            }
            t.end();
        }
    );
});

test('bootstrap in code', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
