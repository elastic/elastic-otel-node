/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-undici-request.js

const undici = require('undici');

async function main() {
    const res = await undici.request('http://www.google.com/');
    console.log('response: %s %o', res.statusCode, res.headers);
    const body = await res.body.text();
    console.log('response body: %s...', body.slice(0, 40));
}

main();
