/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An EDOT Node.js bootstrap module that uses custom SpanProcessors.
 * Used to test dynamic changes to SpanExporters.
 */

import {register} from 'node:module';
import {
    startNodeSDK,
    createAddHookMessageChannel,
    createDynConfSpanExporter,
    tracing,
} from '../../lib/sdk.js'; // @elastic/opentelemetry-node/sdk

const {registerOptions, waitForAllMessagesAcknowledged} =
    createAddHookMessageChannel();
register(
    '@elastic/opentelemetry-node/hook.mjs',
    import.meta.url,
    registerOptions
);

class MySpanProcessor extends tracing.SimpleSpanProcessor {}

startNodeSDK({
    spanProcessors: [
        // This span processor should have its exporter automatically wrapped by
        // `_dynConfWrapSpanProcessors` because `SimpleSpanProcessor` is a
        // known OTel JS SDK class.
        new tracing.SimpleSpanProcessor(new tracing.ConsoleSpanExporter()),
        // This one cannot be automatically wrapped, because the class is
        // not known. The `createDynConfSpanExporter` should do the job.
        // EDOT Node.js should *not* log.warn for this usage.
        new MySpanProcessor(
            createDynConfSpanExporter(new tracing.ConsoleSpanExporter())
        ),
    ],
});

await waitForAllMessagesAcknowledged();
