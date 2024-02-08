/**
 * A "Printer" of metrics data that attempts a reasonable short summary.
 *
 * Dev Notes / Ideas:
 */

const {Printer} = require('./printers');
const {normalizeMetrics} = require('./normalize');

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
                        // TODO do we want to attempt a short summary of histogram buckets?
                        // TODO handle multiple datapoints, dp per normalized attribute set. Highest prio. Run `node -r @elastic/opentelemetry-node/start.js http-server.js` for example data.
                        if (metric.histogram.dataPoints.length !== 1) {
                            this._log.warn(
                                {metric},
                                'metric has other than 1 dataPoint'
                            );
                            rendering.push(`      ${metric.name} (histogram)`);
                        } else {
                            const dp = metric.histogram.dataPoints[0];
                            rendering.push(
                                `      ${metric.name} (histogram, ${
                                    metric.unit
                                }, ${
                                    Object.keys(dp.attributes).length
                                } attrs): min=${dp.min}, max=${dp.max}`
                            );
                        }
                    } else {
                        // TODO handle other metric types better
                        rendering.push(`      ${metric.name} (type=???)`);
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
