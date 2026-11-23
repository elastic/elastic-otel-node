import assert from 'assert';
import {
    startNodeSDK,
    getInstrumentations,
} from '@elastic/opentelemetry-node/sdk';

assert.ok(typeof startNodeSDK === 'function');
assert.ok(typeof getInstrumentations === 'function');

console.log('Success.');
