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

const {metrics} = require('@opentelemetry/api');
const {metrics: metricsSdk} = require('@opentelemetry/sdk-node');
const {Aggregation, View} = metricsSdk;
const {HostMetrics} = require('@opentelemetry/host-metrics');

/** @type {HostMetrics} */
let hostMetricsInstance;
function enableHostMetrics() {
    hostMetricsInstance = new HostMetrics({
        // Pass in default meterProvider to avoid a log.warn('No meter provider, using default').
        meterProvider: metrics.getMeterProvider(),
    });
    hostMetricsInstance.start();
}

// Dropping system metrics because:
// - sends a lot of data. Ref: https://github.com/elastic/elastic-otel-node/issues/51
// - not displayed by Kibana in metrics dashboard. Ref: https://github.com/elastic/kibana/pull/199353
// - recommendation is to use OTEL collector to get and export them
/** @type {metricsSdk.View[]} */
const HOST_METRICS_VIEWS = [
    new View({
        instrumentName: 'system.*',
        aggregation: Aggregation.Drop(),
    }),
];

module.exports = {
    HOST_METRICS_VIEWS,
    enableHostMetrics,
};
