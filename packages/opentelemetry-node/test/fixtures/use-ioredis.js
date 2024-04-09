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

// Usage: node -r ../../start.js use-ioredis.js

const otel = require('@opentelemetry/api');
const {Redis} = require('ioredis');

const redis = new Redis(process.env.REDIS_HOST, {
    maxRetriesPerRequest: 5, // fail fast in testing
});

async function main() {
    let val;

    redis.set('foo', 'bar');
    val = await redis.get('foo');
    console.log('GET foo:', val);

    redis.hset('myhash', 'field1', 'val1');
    try {
        val = await redis.get('myhash'); // Wrong command for type, should reject.
    } catch (e) {
        console.log('able to catch a GET error');
    }

    await redis.quit();
}

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-parent-span', (span) => {
    main();
    span.end();
});
