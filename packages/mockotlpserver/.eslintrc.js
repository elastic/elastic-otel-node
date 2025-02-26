/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const config = require('../../.eslintrc.js');
config.rules['license-header/header'] = [
    'error',
    '../../scripts/license-header.js',
];

module.exports = config;
