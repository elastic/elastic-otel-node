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

// Usage: node -r @elastic/opentelemetry-node use-tedious.js
const semver = require('semver');
const otel = require('@opentelemetry/api');
const version = require('tedious/package.json').version;
const tedious = require('tedious');

const hostname = process.env.MSSQL_HOST;
let connOptions;

if (semver.gte(version, '4.0.0')) {
    connOptions = {
        server: hostname,
        authentication: {
            type: 'default',
            options: {
                userName: 'SA',
                password: process.env.SA_PASSWORD || 'Very(!)Secure',
            },
        },
        options: {
            // Tedious@9 changed to `trustServerCertificate: false` by default.
            trustServerCertificate: true,
            // Silence deprecation warning in tedious@8.
            validateBulkLoadParameters: true,
        },
    };
} else {
    connOptions = {
        server: hostname,
        userName: 'SA',
        password: process.env.SA_PASSWORD || 'Very(!)Secure',
    };
}

async function main() {
    /** @type {import('tedious').Connection}*/
    const connection = await new Promise((resolve, reject) => {
        const conn = new tedious.Connection(connOptions);
        const onConnect = (err) => {
            if (err) return reject(err);
            resolve(conn);
        };

        if (typeof tedious.connect === 'function') {
            // Tedious@8.3.0 deprecated automatic connection and tedious@9 dropped it,
            // requiring `conn.connect(onConnect)` usage.
            //
            // We cannot switch on the presence of `conn.connect` because a different
            // version of that existed before tedious@8.3.0; instead we check for the
            // top-level `tedious.connect` helper that was added in the same commit:
            // https://github.com/tediousjs/tedious/pull/1069
            conn.connect(onConnect);
        } else {
            conn.on('connect', onConnect);
        }
    });

    // Perform a request and disconnect when we get the response
    connection.execSql(
        new tedious.Request('select 1', (err, rowCount, rows) => {
            connection.close();

            if (err) {
                throw err;
            } else {
                console.log('SELECT result:', rowCount, rows);
            }
        })
    );
}

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-parent-span', (span) => {
    main();
    span.end();
});
