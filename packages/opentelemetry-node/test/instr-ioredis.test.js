const test = require('tape');
const {runTestFixtures} = require('./testutils');

const skip = process.env.REDIS_HOST === undefined;
if (skip) {
    console.log(
        '# SKIP ioredis tests: REDIS_HOST is not set (try with `REDIS_HOST=localhost`)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-ioredis.js (CommonJS)',
        args: ['./fixtures/use-ioredis.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // Expected a trace like this:
            //     ------ trace 30edbd (6 spans) ------
            //            span 3bfc84 "manual-parent-span" (2.6ms, SPAN_KIND_INTERNAL)
            //       +2ms `- span 804ab9 "set" (12.3ms, SPAN_KIND_CLIENT)
            //       +0ms `- span 3ee842 "get" (11.8ms, SPAN_KIND_CLIENT)
            //      +12ms `- span 525234 "hset" (0.8ms, SPAN_KIND_CLIENT)
            //       +1ms `- span 4711cd "get" (1.1ms, STATUS_CODE_ERROR, SPAN_KIND_CLIENT)
            //       +1ms `- span e00e0f "quit" (0.6ms, SPAN_KIND_CLIENT)
            const spans = col.sortedSpans;
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
        },
    },
    {
        name: 'use-ioredis.mjs (ESM via --require)',
        versionRanges: {
            // TODO: issue on node docs that https://nodejs.org/api/all.html#all_module_moduleregisterspecifier-parenturl-options history doesn't show backport to v18.19.0
            node: '>=20.6.0 || >=18.19.0', // when `module.require()` was added
        },
        args: ['./fixtures/use-ioredis.mjs'],
        cwd: __dirname,
        env: {
            // XXX test --import as well; test with --experiemental-loader for older node versions
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
            NODE_NO_WARNINGS: '1',
        },
        verbose: true,
        checkTelemetry: assertUseIoredisMjsSpans,
    },

    {
        name: 'use-ioredis.mjs (ESM via --require & --experimental-loader)',
        versionRanges: {
            node: '<18.19.0 || >=20.0.0 <20.6.0',
        },
        args: ['./fixtures/use-ioredis.mjs'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS:
                '--require=@elastic/opentelemetry-node --experimental-loader=@elastic/opentelemetry-node/hook.mjs',
            NODE_NO_WARNINGS: '1',
        },
        verbose: true,
        checkTelemetry: assertUseIoredisMjsSpans,
    },
    {
        name: 'use-ioredis.mjs (ESM via --import)',
        versionRanges: {
            node: '>=20.6.0 || >=18.19.0', // when `module.require()` was added
        },
        args: ['./fixtures/use-ioredis.mjs'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--import=@elastic/opentelemetry-node',
            NODE_NO_WARNINGS: '1',
        },
        verbose: true,
        checkTelemetry: assertUseIoredisMjsSpans,
    },
    {
        name: 'use-ioredis.mjs (ESM via --import & --experimental-loader)',
        versionRanges: {
            // --import was added in v18.18.0.
            node: '>18.18.0 <18.19.0 || >=20.0.0 <20.6.0',
        },
        args: ['./fixtures/use-ioredis.mjs'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS:
                '--import=@elastic/opentelemetry-node --experimental-loader=@elastic/opentelemetry-node/hook.mjs',
            NODE_NO_WARNINGS: '1',
        },
        verbose: true,
        checkTelemetry: assertUseIoredisMjsSpans,
    },

    // TODO: test with both module.register() and --experimental-loader
    /*
XXX HERE
Here is the double IITM hooking issue:

% n 20 --require @elastic/opentelemetry-node --loader @elastic/opentelemetry-node/hook.mjs test/fixtures/use-ioredis.mjs
/Users/trentm/.nvm/versions/node/v20.9.0/bin/node --require @elastic/opentelemetry-node --loader @elastic/opentelemetry-node/hook.mjs test/fixtures/use-ioredis.mjs

node:internal/modules/esm/hooks:669
      throw deserializeError(body.serialized);
      ^
SyntaxError [Error]: Unexpected token '*'
    at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:118:18)
    at callTranslator (node:internal/modules/esm/loader:273:14)
    at ModuleLoader.moduleProvider (node:internal/modules/esm/loader:278:30)
    at async link (node:internal/modules/esm/module_job:76:21)

Node.js v20.9.0
*/
];

function assertUseIoredisMjsSpans(t, col) {
    // Assert that we got the two redis spans expected from 'use-ioredis.mjs'.
    const spans = col.sortedSpans;
    t.equal(spans[1].name, 'set');
    t.equal(spans[1].attributes['db.system'], 'redis');
    t.equal(spans[2].name, 'get');
}

test('ioredis instrumentation', {skip}, (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
