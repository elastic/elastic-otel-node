// Usage: node -r ../../start.js use-winston.js

const winston = require('winston');
const otel = require('@opentelemetry/api');

const logger = winston.createLogger({
    transports: [new winston.transports.Console()],
});

logger.info('hi', {foo: 'bar'});

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-span', (span) => {
    logger.info('with span info');
    span.end();
});
