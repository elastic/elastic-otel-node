// Usage:
//  node -r @elastic/opentelemetry-node/start.js bunyan-logging-app.js

const path = require('path');
const otel = require('@opentelemetry/api');
const bunyan = require('bunyan');

const log = bunyan.createLogger({name: path.parse(__filename).name});

log.info({foo: 'bar'}, 'hi there');
log.warn(new Error('boom'), 'oops');
log.debug('hi at debug-level');

const tracer = otel.trace.getTracer('example');
tracer.startActiveSpan('manual-span', (span) => {
    log.info('this record will have trace-correlation fields');
    span.end();
});
