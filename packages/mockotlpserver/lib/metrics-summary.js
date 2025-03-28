/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
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
                        // histogram "${name}" (unit=${unit}):
                        //     ${metricValueRepr}    | <-- one for each data point
                        //     ${attrsRepr}          |
                        //     --
                        //     ${metricValueRepr}
                        //     ${attrsRepr}
                        rendering.push(
                            `${style('histogram', 'bold')} "${style(
                                metric.name,
                                'magenta'
                            )}" (unit=${metric.unit}):`
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
                    } else if (metric.gauge) {
                        // gauge "${name}" (unit=${unit}):
                        //     ${metricValueRepr} ${attrsRepr}   <-- one for each data point
                        // Merged onto one line if just one data-point.
                        rendering.push(
                            `${style('gauge', 'bold')} "${style(
                                metric.name,
                                'magenta'
                            )}" (unit=${metric.unit})`
                        );
                        const dpReprs = metric.gauge.dataPoints.map((dp) => {
                            let valRepr = `${dp.asDouble}`;
                            if (dp.attributes) {
                                let attrRepr = util.inspect(dp.attributes, {
                                    depth: 10,
                                    colors: true,
                                    breakLength: Infinity,
                                });
                                return [valRepr, attrRepr];
                            } else {
                                return [valRepr];
                            }
                        });
                        if (dpReprs.length === 1) {
                            rendering[rendering.length - 1] +=
                                `: ${dpReprs[0].join(' ')}`.trimEnd();
                        } else if (dpReprs.length > 1) {
                            rendering[rendering.length - 1] += ':';
                            const COL0_WIDTH = Math.max(
                                ...dpReprs.map((dpr) => dpr[0].length)
                            );
                            dpReprs.forEach((dpr) => {
                                rendering.push(
                                    `    ${dpr[0]}${' '.repeat(
                                        COL0_WIDTH - dpr[0].length
                                    )} ${dpr[1]}`.trimEnd()
                                );
                            });
                        }
                    } else if (metric.sum) {
                        // sum "${name}" (unit=${unit}, aggTemp=${delta|cumulative}):
                        //     ${metricValueRepr} ${attrsRepr}   <-- one for each data point
                        // Merged onto one line if just one data-point.
                        let aggTemp;
                        switch (metric.sum.aggregationTemporality) {
                            case 0:
                                aggTemp = 'unspecified';
                                break;
                            case 1:
                                aggTemp = 'delta';
                                break;
                            case 2:
                                aggTemp = 'cumulative';
                                break;
                            default:
                                aggTemp = metric.sum.aggregationTemporality;
                        }
                        rendering.push(
                            `${style('sum', 'bold')} "${style(
                                metric.name,
                                'magenta'
                            )}" (unit=${metric.unit}, aggTemp=${aggTemp})`
                        );
                        const dpReprs = metric.sum.dataPoints.map((dp) => {
                            let valRepr = `${dp.asDouble}`;
                            if (dp.attributes) {
                                let attrRepr = util.inspect(dp.attributes, {
                                    depth: 10,
                                    colors: true,
                                    breakLength: Infinity,
                                });
                                return [valRepr, attrRepr];
                            } else {
                                return [valRepr];
                            }
                        });
                        if (dpReprs.length === 1) {
                            rendering[rendering.length - 1] +=
                                `: ${dpReprs[0].join(' ')}`.trimEnd();
                        } else if (dpReprs.length > 1) {
                            rendering[rendering.length - 1] += ':';
                            const COL0_WIDTH = Math.max(
                                ...dpReprs.map((dpr) => dpr[0].length)
                            );
                            dpReprs.forEach((dpr) => {
                                rendering.push(
                                    `    ${dpr[0]}${' '.repeat(
                                        COL0_WIDTH - dpr[0].length
                                    )} ${dpr[1]}`.trimEnd()
                                );
                            });
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
