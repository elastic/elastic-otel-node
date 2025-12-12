import assert from 'assert';
import {
    startNodeSDK,
    getInstrumentations,
    api,
    tracing,
    core,
} from '@elastic/opentelemetry-node/sdk';

assert.ok(typeof startNodeSDK === 'function');
assert.ok(typeof getInstrumentations === 'function');
assert.ok(typeof api.trace.getTracer === 'function');
assert.ok(typeof tracing.ConsoleSpanExporter === 'function');
assert.ok(typeof core.hrTime === 'function');

console.log('Success.');
