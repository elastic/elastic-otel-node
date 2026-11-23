/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A bootstrap module for EDOT Node.js written in *TypeScript* to test
 * its usage with `tsc` and separately with Node.js's strip-types support.
 *
 * Usage (in a type:module package):
 *  tsc && node --import ./build/telemetry-typescript.js build/app.js
 *  node --experimental-strip-types --import ./telemetry-typescript.ts app.js  # node >=22.6.0 <23.6.0
 *  node --import ./telemetry-typescript.ts app.js  # node >=23.6.0
 */

import {register} from 'node:module';
import type {ReadableSpan, SpanProcessor} from '@opentelemetry/sdk-trace';
import {BatchSpanProcessor} from '@opentelemetry/sdk-trace';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-proto';
import {
    startNodeSDK,
    createAddHookMessageChannel,
} from '@elastic/opentelemetry-node/sdk';

const {registerOptions, waitForAllMessagesAcknowledged} =
    createAddHookMessageChannel();
register(
    '@elastic/opentelemetry-node/hook.mjs',
    import.meta.url,
    registerOptions
);

// Shows an example of implementing and using a custom SpanProcessor.
// This tests that (at least some) OTel types from EDOT Node.js are usable.
class MySpanProcessor implements SpanProcessor {
    onStart(span: ReadableSpan) {
        span.attributes['MySpanProcessor'] = 'was here';
    }
    onEnd(span: ReadableSpan) {}
    async forceFlush() {}
    async shutdown() {}
}

startNodeSDK({
    spanProcessors: [
        new MySpanProcessor(),
        new BatchSpanProcessor({exporter: new OTLPTraceExporter()}),
    ],
});

await waitForAllMessagesAcknowledged();
