/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-bunyan.js

const bunyan = require('bunyan');
const otel = require('@opentelemetry/api');

const log = bunyan.createLogger({name: 'use-bunyan'});

log.info({foo: 'bar'}, 'hi');

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-span', (span) => {
    log.info('with span info');
    span.end();
});
