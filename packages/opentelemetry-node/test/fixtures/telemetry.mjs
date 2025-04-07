/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The typical starter template for bootstrapping EDOT Node.js in code.
 *
 * Usage:
 *  node --import ./telemetry.mjs app.js
 */

import {register} from 'node:module';
import {
    startNodeSDK,
    createAddHookMessageChannel,
} from '@elastic/opentelemetry-node/sdk';

// TODO: document the limitation on 3rd party instrumentations, troubleshooting section
const {registerOptions, waitForAllMessagesAcknowledged} =
    createAddHookMessageChannel();
register(
    '@elastic/opentelemetry-node/hook.mjs',
    import.meta.url,
    registerOptions
);

startNodeSDK();

await waitForAllMessagesAcknowledged();
