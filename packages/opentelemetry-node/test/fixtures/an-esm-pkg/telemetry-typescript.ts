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
import {
    startNodeSDK,
    createAddHookMessageChannel,
    tracing,
} from '@elastic/opentelemetry-node/sdk';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-proto';

const {registerOptions, waitForAllMessagesAcknowledged} =
    createAddHookMessageChannel();
register(
    '@elastic/opentelemetry-node/hook.mjs',
    import.meta.url,
    registerOptions
);

// Shows an example of implementing and using a custom SpanProcessor.
// This tests that (at least some) OTel types from EDOT Node.js are usable.
class MySpanProcessor implements tracing.SpanProcessor {
    onStart(span: tracing.ReadableSpan) {
        span.attributes['MySpanProcessor'] = 'was here';
    }
    onEnd(span: tracing.ReadableSpan) {}
    async forceFlush() {}
    async shutdown() {}
}

startNodeSDK({
    spanProcessors: [
        new MySpanProcessor(),
        new tracing.BatchSpanProcessor(new OTLPTraceExporter()),
    ],
});

await waitForAllMessagesAcknowledged();
