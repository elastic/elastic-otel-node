/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage (with node >=23):
//  node --import @elastic/opentelemetry-node use-ioredis.ts

import {trace} from '@opentelemetry/api';

import assert from 'assert';
import {Redis} from 'ioredis';

const redis = new Redis({
    host: process.env.REDIS_HOST,
    maxRetriesPerRequest: 5, // fail fast in testing
});

// Randomize the key to avoid collisions with parallel testing.
const randomId = ((Math.random() * 2 ** 32) >>> 0).toString(16);
const testKeyName = `test-${randomId}`;

const tracer = trace.getTracer('test');
await tracer.startActiveSpan('manual', async (span) => {
    redis.set(testKeyName, 'bar');
    let val = await redis.get(testKeyName);
    assert(val === 'bar');
    console.log('key "%s": "%s"', testKeyName, val);
    span.end();
});

await redis.quit();
