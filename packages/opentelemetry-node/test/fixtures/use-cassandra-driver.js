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
    await client.execute(`CREATE KEYSPACE IF NOT EXISTS ${keyspace} WITH replication = { 'class': 'SimpleStrategy', 'replication_factor': 1 };`);
    await client.execute(`USE ${keyspace}`);
    await client.execute(`CREATE TABLE IF NOT EXISTS ${keyspace}.${table}(id uuid,text varchar,PRIMARY KEY(id));`);
    await client.batch([
        {
            query: `INSERT INTO ${keyspace}.${table} (id, text) VALUES (uuid(), ?)`,
            params: ['value1']
        },
        {
            query: `INSERT INTO ${keyspace}.${table} (id, text) VALUES (uuid(), ?)`,
            params: ['value2']
        }
    ]);
    await client.execute(`DROP TABLE IF EXISTS ${keyspace}.${table}`);
    await client.shutdown();
}
const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-span', async (span) => {
    await main();
    span.end();
});
