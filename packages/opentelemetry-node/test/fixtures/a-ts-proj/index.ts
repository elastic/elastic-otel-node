import assert from 'assert/strict';
import { ElasticNodeSDK, getInstrumentations } from '@elastic/opentelemetry-node/sdk';
console.log('ElasticNodeSDK: ', ElasticNodeSDK);
console.log('getInstrumentations: ', getInstrumentations);
assert.ok(typeof getInstrumentations === 'function');
console.log('Success.')
