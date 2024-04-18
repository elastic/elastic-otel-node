/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

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
            // The default metrics interval is 30s, which makes for a slow test.
            // However, too low a value runs into possible:
            //      PeriodicExportingMetricReader: metrics collection errors TimeoutError: Operation timed out.
            // which can lead to test data surprises.
            OTEL_METRIC_EXPORT_INTERVAL: '1000',
            OTEL_METRIC_EXPORT_TIMEOUT: '900',
        },
        // verbose: true,
        checkTelemetry: (t, collector) => {
            const metrics = collector.metrics;
            const networkMetrics = metrics.filter((metric) =>
                metric.name.startsWith('system.network')
            );
            const processMetrics = metrics.filter((metric) =>
                metric.name.startsWith('process.')
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
            t.ok(processMetrics.length === 0, 'process.* metrics are dropped');
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
                //   {
                //     "startTimeUnixNano": "1713354074349000000",
                //     "timeUnixNano": "1713354074349000000",
                //     "asDouble": 1.005859375,
                //     "attributes":
                //       {
                //         "system.cpu.state": "idle",
                //         "system.cpu.logical_number": "11"
                //       }
                //   },
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
                    metric.gauge?.dataPoints?.every(
                        (dp) =>
                            dp.attributes &&
                            dp.attributes['system.cpu.state'] &&
                            dp.attributes['system.cpu.logical_number']
                    ),
                    'data points have "system.cpu.state" and "system.cpu.logical_number" attributes'
                );
            });
        },
    },
];

test('host metrics', (suite) => {
    runTestFixtures(suite, testFixtures);
    suite.end();
});
