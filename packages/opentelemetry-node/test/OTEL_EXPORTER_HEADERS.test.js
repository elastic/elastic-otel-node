// Test that usage of `OTEL_EXPORTER_OTLP_HEADERS` works as expected.

const {test} = require('tape');
const {safeGetPackageVersion, runTestFixtures} = require('./testutils');

const ELASTIC_SDK_VERSION = require('../package.json').version;
const ELASTIC_UA_PREFIX = `elastic-otel-node/${ELASTIC_SDK_VERSION}`;
const OTEL_EXPORTER_VERSION = safeGetPackageVersion(
    '@opentelemetry/otlp-exporter-base'
);
const OTEL_UA_EXPORTER = `OTel-OTLP-Exporter-JavaScript/${OTEL_EXPORTER_VERSION}`;
const USER_AGENT_HEADER = `User-Agent=${ELASTIC_UA_PREFIX} ${OTEL_UA_EXPORTER}`;

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'basic scenario without User-Agent set',
        args: ['./fixtures/use-env.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=../start.js',
            OTEL_EXPORTER_OTLP_TRACES_HEADERS: 't-key=t-value,key=override',
            OTEL_EXPORTER_OTLP_METRICS_HEADERS: 'm-key=m-value',
            OTEL_EXPORTER_OTLP_LOGS_HEADERS: 'l-key=l-value',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const getLine = (start) => lines.find((l) => l.startsWith(start));
            t.equal(
                getLine('OTEL_EXPORTER_OTLP_TRACES_HEADERS'),
                `OTEL_EXPORTER_OTLP_TRACES_HEADERS ${USER_AGENT_HEADER},t-key=t-value,key=override`
            );
            t.equal(
                getLine('OTEL_EXPORTER_OTLP_METRICS_HEADERS'),
                `OTEL_EXPORTER_OTLP_METRICS_HEADERS ${USER_AGENT_HEADER},m-key=m-value`
            );
            t.equal(
                getLine('OTEL_EXPORTER_OTLP_LOGS_HEADERS'),
                `OTEL_EXPORTER_OTLP_LOGS_HEADERS ${USER_AGENT_HEADER},l-key=l-value`
            );
        },
    },
    {
        name: 'scenario with User-Agent override',
        args: ['./fixtures/use-env.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=../start.js',
            OTEL_EXPORTER_OTLP_TRACES_HEADERS: 't-key=t-value,User-Agent=t-ua',
            OTEL_EXPORTER_OTLP_METRICS_HEADERS: 'm-key=m-value,User-Agent=m-ua',
            OTEL_EXPORTER_OTLP_LOGS_HEADERS: 'l-key=l-value,User-Agent=l-ua',
        },
        // verbose: true,
        checkResult: (t, err, stdout, stderr) => {
            t.error(err);
            const lines = stdout.split('\n');
            const getLine = (start) => lines.find((l) => l.startsWith(start));
            t.equal(
                getLine('OTEL_EXPORTER_OTLP_TRACES_HEADERS'),
                'OTEL_EXPORTER_OTLP_TRACES_HEADERS User-Agent=t-ua,t-key=t-value'
            );
            t.equal(
                getLine('OTEL_EXPORTER_OTLP_METRICS_HEADERS'),
                'OTEL_EXPORTER_OTLP_METRICS_HEADERS User-Agent=m-ua,m-key=m-value'
            );
            t.equal(
                getLine('OTEL_EXPORTER_OTLP_LOGS_HEADERS'),
                'OTEL_EXPORTER_OTLP_LOGS_HEADERS User-Agent=l-ua,l-key=l-value'
            );
        },
    },
];

test('OTEL_EXPORTER_OTLP[*]_HEADERS', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
