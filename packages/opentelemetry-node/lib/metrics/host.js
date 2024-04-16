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

const {metrics} = require('@opentelemetry/sdk-node');
const {Aggregation, View} = metrics;
const {HostMetrics} = require('@opentelemetry/host-metrics');

/** @type {HostMetrics} */
let hostMetricsInstance;
function enableHostMetrics() {
    // @ts-ignore - config interface expects a `name` property but there is a default value
    hostMetricsInstance = new HostMetrics({});
    hostMetricsInstance.start();
}

// It is known that host metrics sends a lot of data so for now we drop some
// instruments that are not handled by Kibana and doing aggregations
// for others that we want to include shorly (CPU metrics)
// Ref (data amount issue): https://github.com/elastic/elastic-otel-node/issues/51
// Ref (metrics in Kibana): https://github.com/elastic/kibana/pull/174700
/** @type {metrics.View[]} */
const HOST_METRICS_VIEWS = [
    // drop `system.network.*` (not in Kibana)
    new View({
        instrumentName: 'system.network.*',
        aggregation: Aggregation.Drop(),
    }),
    // drop `system.cpu.time` (not in Kibana)
    new View({
        instrumentName: 'system.cpu.time',
        aggregation: Aggregation.Drop(),
    }),
    // drop `process.*` (not in Kibana)
    new View({
        instrumentName: 'process.*',
        aggregation: Aggregation.Drop(),
    }),
];

module.exports = {
    HOST_METRICS_VIEWS,
    enableHostMetrics,
};
