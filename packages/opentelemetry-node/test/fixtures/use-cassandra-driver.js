/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-cassandra-driver.js

const cassandra = require('cassandra-driver');
const otel = require('@opentelemetry/api');

const host = process.env.CASSANDRA_HOST;
const port = process.env.CASSANDRA_PORT || '9042';
const keyspace = 'keyspace1';
const table = 'table1';

async function main() {
    const client = new cassandra.Client({
        contactPoints: [`${host}:${port}`],
        localDataCenter: 'datacenter1',
    });

    await client.connect();
    await client.execute(
        `CREATE KEYSPACE IF NOT EXISTS ${keyspace} WITH replication = { 'class': 'SimpleStrategy', 'replication_factor': 1 };`
    );
    await client.execute(`USE ${keyspace}`);
    await client.execute(
        `CREATE TABLE IF NOT EXISTS ${keyspace}.${table}(id uuid,text varchar,PRIMARY KEY(id));`
    );
    await client.batch([
        {
            query: `INSERT INTO ${keyspace}.${table} (id, text) VALUES (uuid(), ?)`,
            params: ['value1'],
        },
        {
            query: `INSERT INTO ${keyspace}.${table} (id, text) VALUES (uuid(), ?)`,
            params: ['value2'],
        },
    ]);
    await client.execute(`DROP TABLE IF EXISTS ${keyspace}.${table}`);
    await client.shutdown();
}
const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-span', async (span) => {
    await main();
    span.end();
});
