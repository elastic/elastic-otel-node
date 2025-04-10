/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage:
//  export ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING=true
//  node --import @elastic/opentelemetry-node bunyan-logging-app.mjs   # or
//  node --import ./telemetry.mjs             bunyan-logging-app.mjs

import path from 'path';
import {trace} from '@opentelemetry/api';
import bunyan from 'bunyan';

const log = bunyan.createLogger({
    name: path.parse(new URL('', import.meta.url).pathname).name,
});

log.info({foo: 'bar'}, 'hi there');

const tracer = trace.getTracer('example');
tracer.startActiveSpan('manual-span', (span) => {
    log.info('inside a span');
    span.end();
});
