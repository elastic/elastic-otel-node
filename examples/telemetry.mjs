/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This is a starter template for bootstrapping the EDOT Node.js SDK in code.
 *
 * Typically, you can `node --import @elastic/opentelemetry-node app.js` directly
 * without having to write any bootstrap code. However, for more advanced configuration
 * of the SDK (e.g. writing a custom SpanProcessor, configuring metrics Views,
 * hardcoding some configuration settings) you might want or need to bootstrap
 * the SDK in code.
 *
 * WARNING: Bootstrapping in code often means using OpenTelemetry JS APIs that
 * are **not yet stable**. These APIs may break in *minor* versions of
 * `@elastic/opentelemetry-node`.
 *
 * Usage:
 *  node --import ./telemetry.mjs app.js
 */

import {register} from 'node:module';
import {
    startNodeSDK,
    createAddHookMessageChannel,
} from '@elastic/opentelemetry-node/sdk';

// Setup the hook for ES Module (ESM) instrumentation.
const {registerOptions, waitForAllMessagesAcknowledged} =
    createAddHookMessageChannel();
register(
    '@elastic/opentelemetry-node/hook.mjs',
    import.meta.url,
    registerOptions
);

/**
 * Start the NodeSDK.
 *
 * - This function accepts all of the configuration options that the
 *   OpenTelemetry JS `NodeSDK` does. See:
 *   https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-sdk-node#configuration
 *
 * - In addition, it accepts some Elastic-specific configuration options.
 *   See `ElasticNodeSDKOptions` in "types/sdk.d.ts":
 *   https://github.com/elastic/elastic-otel-node/blob/main/packages/opentelemetry-node/types/sdk.d.ts
 *
 * - Many useful OpenTelemetry JS SDK classes and utilities are re-exported.
 *   For example:
 *
 *      import { core, tracing } from '@elastic/opentelemetry-node/sdk';
 *      core.hrTime();
 *      new tracing.ConsoleSpanExporter();
 *      class MySpanProcessor implements tracing.SpanProcessor { ... }
 */
startNodeSDK();

await waitForAllMessagesAcknowledged();
