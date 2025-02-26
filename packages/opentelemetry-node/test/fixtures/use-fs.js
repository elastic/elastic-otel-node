/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-fs.js

const {join} = require('path');
const {stat} = require('fs');
const {trace} = require('@opentelemetry/api');

const path = join(__dirname, 'use-fs.js');

async function main() {
    await new Promise((resolve, reject) => {
        stat(path, (err, st) => {
            if (err) {
                reject(err);
            } else {
                resolve(st);
            }
        });
    });
}

const tracer = trace.getTracer('test');
tracer.startActiveSpan('manual-span', async (span) => {
    await main();
    span.end();
});
