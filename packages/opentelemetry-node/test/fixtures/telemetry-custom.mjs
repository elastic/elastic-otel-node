/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An EDOT Node.js bootstrap module that applies some customizations, to
 * test that they work. (Compare to "telemetry.mjs".)
 *
 * Usage:
 *  node --import ./telemetry-custom.mjs app.js
 */

import {register} from 'node:module';
import {
    startNodeSDK,
    createAddHookMessageChannel,
    getInstrumentations,
} from '@elastic/opentelemetry-node/sdk';

const {registerOptions, waitForAllMessagesAcknowledged} =
    createAddHookMessageChannel();
register(
    '@elastic/opentelemetry-node/hook.mjs',
    import.meta.url,
    registerOptions
);

startNodeSDK({
    serviceName: process.env.MY_SERVICE_NAME,
    instrumentations: getInstrumentations({
        '@opentelemetry/instrumentation-http': {
            applyCustomAttributesOnSpan: (span) => {
                span.setAttribute('foo', 'bar');
            },
        },
        '@opentelemetry/instrumentation-bunyan': {
            disableLogSending: false,
            logHook: (span, rec) => {
                rec['hello'] = 'from logHook';
            }
        },
    }),
});

await waitForAllMessagesAcknowledged();
