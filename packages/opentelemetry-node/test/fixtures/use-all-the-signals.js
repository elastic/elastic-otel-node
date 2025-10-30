/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage:
// ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING=true node -r @elastic/opentelemetry-node use-all-the-signals.js

const http = require('http');
const bunyan = require('bunyan');

const log = bunyan.createLogger({name: 'use-all-the-signals'});
http.get('http://www.google.com/', (res) => {
    log.info(
        {statusCode: res.statusCode, headers: res.headers},
        'client response'
    );
    res.resume();
    res.on('end', () => {
        log.info('client response: end');
    });
});
