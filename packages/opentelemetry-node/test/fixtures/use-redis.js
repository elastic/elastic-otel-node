/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
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
