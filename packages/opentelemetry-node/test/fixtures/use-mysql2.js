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

// Usage: node -r @elastic/opentelemetry-node use-mysql2.js

const otel = require('@opentelemetry/api');
var mysql2 = require('mysql2/promise');

const host = process.env.MYSQL_HOST;
const user = process.env.MYSQL_USER || 'root';
const database = process.env.MYSQL_DATABASE || 'mysql';

async function main() {
    const connection = await mysql2.createConnection({
        host, user, database
    });
    const [ result ] = await connection.query('SELECT 1+1 as solution');

    console.log('Mysql query result',  result);
    await connection.end();
}

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-parent-span', async (span) => {
    await main();
    span.end();
});
