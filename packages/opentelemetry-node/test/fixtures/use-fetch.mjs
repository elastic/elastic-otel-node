/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node --import @elastic/opentelemetry-node use-fetch.mjs

const res = await fetch('http://www.google.com/');
console.log(
    'fetch response: %s %o',
    res.status,
    Object.fromEntries(res.headers.entries())
);
const body = await res.text();
console.log('fetch body: %s...', body.slice(0, 40));
