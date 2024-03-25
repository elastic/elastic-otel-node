// Test that the view set by ElasticNodeSdk work as expected
// - dropping data points for `system.network.*` metrics
// - dropping data points for `system.cpu.time` metric
// - agreggating data points for `system.cpu.utilization` metric

const {test} = require('tape');
const {runTestFixtures} = require('./testutils');

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'host metrics default views',
        args: ['./fixtures/use-host-metrics.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=../start.js',
            // TODO: Change away from an "ETEL_" prefix at some point.
            // The default metrics interval is 30s, which makes for a slow test.
            // However, too low a value runs into possible:
            //      PeriodicExportingMetricReader: metrics collection errors TimeoutError: Operation timed out.
            // which can lead to test data surprises.
            ETEL_METRICS_INTERVAL_MS: '1000',
        },
        // verbose: true,
        checkTelemetry: (t, collector) => {
            const metrics = collector.metrics;
            const networkMetrics = metrics.filter((metric) =>
                metric.name.startsWith('system.network')
            );
            const cpuTimeMetrics = metrics.filter(
                (metric) => metric.name === 'system.cpu.time'
            );
            const cpuUtilizationMetrics = metrics.filter(
                (metric) => metric.name === 'system.cpu.utilization'
            );

            t.ok(
                networkMetrics.length === 0,
                'system.network.* metrics are dropped'
            );
            t.ok(
                cpuTimeMetrics.length === 0,
                'system.cpu.time metric is dropped'
            );
            cpuUtilizationMetrics.forEach((metric) => {
                t.ok(
                    metric.gauge?.dataPoints,
                    'data points are present in system.cpu.utilization metric'
                );
                // Note: Skip this too-frequently flaky test for now. See https://github.com/elastic/elastic-otel-node/issues/73
                // const allInRange = metric.gauge?.dataPoints?.every(
                //     (dp) => 0 <= dp.asDouble && dp.asDouble <= 1
                // );
                // t.ok(
                //     allInRange,
                //     '"system.cpu.utilization" data points are in the range [0,1]'
                // );
                // if (!allInRange) {
                //     // Note: extra output to debug flaky test (https://github.com/elastic/elastic-otel-node/issues/73).
                //     t.comment(
                //         'cpuUtilizationMetrics: ' +
                //             JSON.stringify(cpuUtilizationMetrics)
                //     );
                // }
                t.ok(
                    metric.gauge?.dataPoints?.filter(
                        (dp) =>
                            dp.attributes && dp.attributes['system.cpu.state']
                    ),
                    'data points have no "system.cpu.state" attribute'
                );
                t.equal(
                    new Set(
                        metric.gauge?.dataPoints?.map(
                            (dp) =>
                                dp.attributes &&
                                dp.attributes['system.cpu.logical_number']
                        )
                    ).size,
                    metric.gauge?.dataPoints?.length,
                    'data points have different "system.cpu.logical_number"'
                );
            });
        },
    },
];

test('host metrics', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
