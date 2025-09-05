/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node --import @elastic/opentelemetry-node use-oracledb.js

const otel = require('@opentelemetry/api');
var oracledb = require('oracledb');

const host = process.env.ORACLE_HOST;
const user = process.env.ORACLE_USER || 'otel';
const password = process.env.ORACLE_PASSWORD || 'secret';
const connectString =
    process.env.ORACLE_CONNECTSTRING || 'localhost:1521/freepdb1';

async function main() {
    const connection = await oracledb.getConnection({
        user,
        password,
        connectString,
    });

    await connection.execute('SELECT 1+1 as solution');
    await connection.close();
}

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-parent-span', async (span) => {
    await main();
    span.end();
});
