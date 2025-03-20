/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {AggregationType} = require('@opentelemetry/sdk-metrics');
const {HostMetrics} = require('@opentelemetry/host-metrics');

/** @type {HostMetrics} */
let hostMetricsInstance;
function enableHostMetrics() {
    hostMetricsInstance = new HostMetrics();
    hostMetricsInstance.start();
}

// Dropping system metrics because:
// - sends a lot of data. Ref: https://github.com/elastic/elastic-otel-node/issues/51
// - not displayed by Kibana in metrics dashboard. Ref: https://github.com/elastic/kibana/pull/199353
// - recommendation is to use OTEL collector to get and export them
/** @type {import('@opentelemetry/sdk-metrics').ViewOptions[]} */
const HOST_METRICS_VIEWS = [
    {
        instrumentName: 'system.*',
        aggregation: {type: AggregationType.DROP},
    },
];

module.exports = {
    HOST_METRICS_VIEWS,
    enableHostMetrics,
};
