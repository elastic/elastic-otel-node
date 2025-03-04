/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {MockOtlpServer} = require('./mockotlpserver');
const {
    normalizeLogs,
    normalizeTrace,
    normalizeMetrics,
} = require('./normalize');

module.exports = {
    MockOtlpServer,
    normalizeLogs,
    normalizeTrace,
    normalizeMetrics,
};
