/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-pino.js

const pino = require('pino');
const otel = require('@opentelemetry/api');

const log = pino();

log.info({foo: 'bar'}, 'hi');

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-span', (span) => {
    log.info('with span info');
    span.end();
});
