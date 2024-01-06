// Test that 'http' instrumentation generates the telemetry we expect.

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

const testFixtures = [
    {
        name: 'http.get',
        args: ['./fixtures/use-http-get.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=../start.js',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            const spans = col.sortedSpans;
            t.equal(spans.length, 1);
            const span = spans[0];
            t.equal(span.scope.name, '@opentelemetry/instrumentation-http');
            t.equal(span.name, 'GET');
            t.equal(span.kind, 'SPAN_KIND_CLIENT');
        },
    },
];

test('http instrumentation', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
