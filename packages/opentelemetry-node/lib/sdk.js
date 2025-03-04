/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// This is the '@elastic/opentelemetry-node/sdk' entry-point.

const {ElasticNodeSDK} = require('./elastic-node-sdk');
const {getInstrumentations} = require('./instrumentations');

// TODO: this should reexport things from @otel/sdk-node (like 'api', 'core', etc.)

module.exports = {
    ElasticNodeSDK,
    getInstrumentations,
};
