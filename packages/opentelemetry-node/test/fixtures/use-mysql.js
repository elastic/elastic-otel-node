/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-mysql.js

const otel = require('@opentelemetry/api');
var mysql = require('mysql');

const host = process.env.MYSQL_HOST;
const user = process.env.MYSQL_USER || 'root';
const database = process.env.MYSQL_DATABASE || 'mysql';

async function main() {
    const connection = mysql.createConnection({
        host,
        user,
        database,
    });
    const query = connection.query('SELECT 1+1 as solution');

    query.on('result', (result) => {
        console.log('MySQL result', result);
    });
    await new Promise((resolve) => query.on('end', resolve));
    await new Promise((resolve) => connection.end(resolve));
}

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-parent-span', async (span) => {
    await main();
    span.end();
});
