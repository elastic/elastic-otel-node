/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node --import @elastic/opentelemetry-node use-redis.mjs

import {trace} from '@opentelemetry/api';

import assert from 'assert';
import Redis from 'redis';

const client = Redis.createClient({
    socket: {
        port: '6379',
        host: process.env.REDIS_HOST,
    },
});

// Randomize the key to avoid collisions with parallel testing.
const randomId = ((Math.random() * 2 ** 32) >>> 0).toString(16);
const testKeyName = `test-${randomId}`;

const tracer = trace.getTracer('test');
await tracer.startActiveSpan('manual', async (span) => {
    await client.connect();
    await client.set(testKeyName, 'bar');
    let val = await client.get(testKeyName);
    assert(val === 'bar');
    console.log('key "%s": "%s"', testKeyName, val);
    span.end();
});

await client.quit();
