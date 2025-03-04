/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-redis.js

const otel = require('@opentelemetry/api');
const redis = require('redis');

const client = redis.createClient({
    socket: {
        port: '6379',
        host: process.env.REDIS_HOST,
    },
});

async function main() {
    await client.connect();
    await client.set('bar', 'baz');

    let val;
    val = await client.get('bar');
    console.log('GET bar:', val);
    client.hSet('ahash', 'field1', 'val1');
    try {
        val = await client.get('ahash'); // Wrong command for type, should reject.
    } catch (e) {
        console.log('able to catch a GET error');
    }

    await client.quit();
}

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-parent-span', async (span) => {
    await main();
    span.end();
});
