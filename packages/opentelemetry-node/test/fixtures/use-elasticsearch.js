#!/usr/bin/env node --unhandled-rejections=strict

/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage:
//   npm run test-services:start elasticsearch
//   node -r @elastic/opentelemetry-node use-elasticsearch.js
//   npm run test-services:stop

const {Client} = require('@elastic/elasticsearch');

const client = new Client({
    node: process.env.ES_URL || 'http://localhost:9200',
    auth: {
        username: process.env.ES_USERNAME || undefined,
        password: process.env.ES_PASSWORD || undefined,
    },
    maxRetries: 1,
});

async function run() {
    try {
        const res = await client.search({q: 'pants'});
        console.log('search hits:', res.hits);
    } catch (err) {
        console.log('search error:', err.message);
    }
}

run();
