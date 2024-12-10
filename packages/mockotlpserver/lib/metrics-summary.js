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

/**
 * A "Printer" of metrics data that attempts a reasonable short summary.
 *
 * Dev Notes / Ideas:
 */

const util = require('util');

const {Printer} = require('./printers');
const {normalizeMetrics} = require('./normalize');
const {style} = require('./styling');

class MetricsSummaryPrinter extends Printer {
    printMetrics(rawMetrics) {
        const metrics = normalizeMetrics(rawMetrics);

        const rendering = [];
        // TODO add size of request in bytes, perhaps useful for debugging
        // TODO add a summary of service.names (from resource) and scopes to the title line
        rendering.push(`------ metrics ------`);
        const scopes = [];
        for (let resourceMetric of metrics.resourceMetrics) {
            for (let scopeMetric of resourceMetric.scopeMetrics || []) {
                const scope = `${scopeMetric.scope.name}@${scopeMetric.scope.version}`;
                scopes.push(scope);
                for (let metric of scopeMetric.metrics) {
                    if (metric.histogram) {
                        // histogram "${name}" (unit=${unit})
                        //     ${metricValueRepr}    | <-- one for each data point
                        //     ${attrsRepr}          |
                        //     --
                        //     ${metricValueRepr}
                        //     ${attrsRepr}
                        rendering.push(
                            `${style('histogram', 'bold')} "${style(
                                metric.name,
                                'magenta'
                            )}" (unit=${metric.unit})`
                        );
                        for (
                            let i = 0;
                            i < metric.histogram.dataPoints.length;
                            i++
                        ) {
                            if (i > 0) {
                                rendering.push('    --');
                            }
                            const dp = metric.histogram.dataPoints[i];
                            // TODO: consider a meaningful repr of the histogram buckets
                            rendering.push(
                                `    count=${dp.count}, min=${dp.min}, max=${dp.max}`
                            );
                            if (
                                dp.attributes &&
                                Object.keys(dp.attributes).length > 0
                            ) {
                                let attrSummary = util.inspect(dp.attributes, {
                                    depth: 10,
                                    colors: true,
                                    breakLength: Infinity,
                                });
                                rendering.push('    ' + attrSummary);
                            }
                        }
                    } else {
                        // TODO handle other metric types better
                        rendering.push(`metricType??? "${metric.name}"`);
                    }
                }
            }
        }

        // Hack delay in printing so that this "summary" printer output
        // appears after "inspect" or "json" printer output for other signals
        // flushed at about the same time.
        setTimeout(() => {
            console.log(rendering.join('\n'));
        }, 10);
    }
}

module.exports = {
    MetricsSummaryPrinter,
};
