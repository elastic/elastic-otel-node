// Test that the metadata is set as expected.
// https://github.com/elastic/opentelemetry-dev/blob/main/docs/specification/agents/otel-distros.md

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

const DISTRO_VERSION = require('../package.json').version;

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'agent metadata default case',
        args: ['./fixtures/use-http-get.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        checkTelemetry: (t, collector) => {
            const span = collector.sortedSpans[0];
            const attribs = span.resource.attributes;

            // Test OTel SDK add its metadata
            t.equal(attribs['telemetry.sdk.language'], 'nodejs');
            t.equal(attribs['telemetry.sdk.name'], 'opentelemetry');
            t.ok(attribs['telemetry.sdk.version']);
            // Test metadata from the distro
            t.equal(attribs['telemetry.distro.name'], 'elastic');
            t.equal(attribs['telemetry.distro.version'], DISTRO_VERSION);
        },
    },
];

test('agent metadata', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
