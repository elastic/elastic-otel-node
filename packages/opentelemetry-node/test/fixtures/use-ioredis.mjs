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

// Usage: node -r @elastic/opentelemetry-node use-ioredis.mjs

import {trace} from '@opentelemetry/api';

import assert from 'assert';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_HOST, {
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
