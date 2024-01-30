// Test that usage of `OTEL_LOG_LEVEL` works as expected.

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'diag default',
        args: ['./fixtures/use-diag.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=../start.js',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            t.ok(/hi at info/.test(stdout), 'info');
            t.ok(/hi at warn/.test(stdout), 'warn');
            t.ok(/hi at error/.test(stdout), 'error');
            t.ok(/OTEL_LOG_LEVEL: undefined/.test(stdout), 'envvar');
        },
    },
    {
        name: 'diag OTEL_LOG_LEVEL=debug',
        args: ['./fixtures/use-diag.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=../start.js',
            OTEL_LOG_LEVEL: 'debug',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            t.ok(/hi at debug/.test(stdout), 'debug');
            t.ok(/hi at info/.test(stdout), 'info');
            t.ok(/hi at warn/.test(stdout), 'warn');
            t.ok(/hi at error/.test(stdout), 'error');
            t.ok(/OTEL_LOG_LEVEL: debug/.test(stdout), 'envvar');
        },
    },
    {
        name: 'diag OTEL_LOG_LEVEL=VerBoSe (allow any case)',
        args: ['./fixtures/use-diag.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=../start.js',
            OTEL_LOG_LEVEL: 'VerBoSe',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            t.ok(/hi at verbose/.test(stdout), 'verbose');
            t.ok(/hi at debug/.test(stdout), 'debug');
            t.ok(/hi at info/.test(stdout), 'info');
            t.ok(/hi at warn/.test(stdout), 'warn');
            t.ok(/hi at error/.test(stdout), 'error');
            t.ok(/OTEL_LOG_LEVEL: VerBoSe/.test(stdout), 'envvar');
        },
    },
];

test('OTEL_LOG_LEVEL', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
