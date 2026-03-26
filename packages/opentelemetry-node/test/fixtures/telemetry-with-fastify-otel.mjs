/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An example EDOT Node.js bootstrap script that adds `@fastify/otel`
 * instrumentation.
 *
 * Usage:
 *  node --import ./telemetry-with-fastify-otel.mjs app.js
 */

import {register} from 'node:module';
import {
    startNodeSDK,
    getInstrumentations,
} from '@elastic/opentelemetry-node/sdk';
import FastifyOtelInstrumentation from '@fastify/otel';

register('@elastic/opentelemetry-node/hook.mjs', import.meta.url);
startNodeSDK({
    instrumentations: [
        new FastifyOtelInstrumentation({registerOnInitialization: true}),
        ...getInstrumentations(),
    ],
});
