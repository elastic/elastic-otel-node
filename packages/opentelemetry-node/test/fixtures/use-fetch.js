/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-fetch.js

async function main() {
    const res = await fetch('http://www.google.com/');
    console.log(
        'fetch response: %s %o',
        res.status,
        Object.fromEntries(res.headers.entries())
    );
    const body = await res.text();
    console.log('fetch body: %s...', body.slice(0, 40));
}

main();
