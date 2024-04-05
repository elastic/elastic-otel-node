// Test that 'winston' instrumentation generates the telemetry we expect.

const test = require('tape');
const {runTestFixtures} = require('./testutils');

let recs; // somewhat clumsy passing from checkResult to checkTelemetry

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-winston',
        args: ['./fixtures/use-winston.js'],
        cwd: __dirname,
        env: {
            OTEL_LOG_LEVEL: 'none',
            NODE_OPTIONS: '--require=../start.js',
        },
        // verbose: true,
        checkResult: (t, err, stdout, _stderr) => {
            t.error(err, `exited successfully: err=${err}`);
            recs = stdout.trim().split(/\n/g).map(JSON.parse);
        },
        checkTelemetry: (t, col) => {
            // We expect telemetry like this:
            // TODO: waiting for log sending from https://github.com/open-telemetry/opentelemetry-js-contrib/pull/1837 to be in an otel-js-contrib release
            const spans = col.sortedSpans;
            t.equal(spans.length, 1);

            // Check log records to stdout.
            t.equal(recs.length, 2);
            t.equal(recs[0].level, 'info');
            t.equal(recs[0].message, 'hi');
            t.equal(recs[1].level, 'info');
            t.equal(recs[1].message, 'with span info');
            t.equal(recs[1].trace_id, spans[0].traceId);
            t.equal(recs[1].span_id, spans[0].spanId);

            const logs = col.logs;
            t.equal(logs.length, 2);
            t.equal(logs[0].severityText, 'info');
            t.equal(logs[0].body, 'hi');
            t.deepEqual(logs[0].attributes, {foo: 'bar'});
            t.equal(logs[0].scope.name, '@opentelemetry/winston-transport');
            t.equal(logs[1].severityText, 'info');
            t.equal(logs[1].body, 'with span info');
            // TODO: test these after https://github.com/open-telemetry/opentelemetry-js-contrib/issues/2010 is resolved
            // t.equal(logs[1].traceId, spans[0].traceId);
            // t.equal(logs[1].spanId, spans[0].spanId);
        },
    },
];

test('winston instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
