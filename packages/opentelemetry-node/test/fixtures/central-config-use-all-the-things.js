/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {setTimeout} = require('timers/promises');
const {get: httpGet} = require('http');
const {
    DIAG_CH_SEND_SUCCESS,
    barrierOpAMPClientDiagEvents,
    setElasticConfig,
} = require('../ccutils');
const {trace} = require('@opentelemetry/api');

const tracer = trace.getTracer('central-config-logs-signal');

const allTheThings = [
    {
        name: 'pg',
        setup: async () => {
            const {Client} = require('pg');
            const client = new Client({user: process.env.PGUSER || 'postgres'});
            await client.connect();
            return client;
        },
        use: async (client, marker) => {
            const res = await client.query('SELECT $1::text as message', [
                marker,
            ]);
            console.log('SELECT result:', res.rows[0].message);
        },
        teardown: async (client) => {
            await client.end();
        },
    },

    {
        name: 'http.get',
        use: async (_, marker) => {
            return new Promise((resolve) => {
                httpGet(`http://www.google.com/search?q=${marker}`, (res) => {
                    res.resume();
                    res.on('end', () => {
                        console.log('http.get: response end,', res.statusCode);
                        resolve();
                    });
                });
            });
        },
    },

    {
        name: 'mongodb',
        setup: async () => {
            const {MongoClient} = require('mongodb');
            const host = process.env.MONGODB_HOST;
            const port = process.env.MONGODB_PORT || '27017';
            const url = `mongodb://${host}:${port}`;
            const client = new MongoClient(url, {
                serverSelectionTimeoutMS: 3000,
            });
            await client.connect();
            const database = client.db('test-db');
            const collection = database.collection('test-col');
            return {client, database, collection};
        },
        use: async (state, marker) => {
            const res = await state.collection.insertMany([{marker}], {w: 1});
            console.log('mongodb: insertMany response:', res);
        },
        teardown: async (state) => {
            await state.client.close();
        },
    },

    // Note: Ideally all the rest of the instrumentations would get a test here.
    // However, that is look of effort and maint. We will add these as needed.
];

async function main() {
    const keepAlive = setInterval(() => {}, 1000); // keep the Node.js process alive

    await tracer.startActiveSpan('setup', async (span) => {
        for await (let thing of allTheThings) {
            if (thing.setup) {
                thing.state = await thing.setup();
            }
        }
        span.end();
    });

    // Phase A: should see telemetry.
    await tracer.startActiveSpan('a', async (span) => {
        for await (let thing of allTheThings) {
            await thing.use(thing.state, 'a');
        }
        span.end();
    });

    if (process.env.ELASTIC_OTEL_OPAMP_ENDPOINT) {
        await setElasticConfig({deactivate_all_instrumentations: 'true'});
        await barrierOpAMPClientDiagEvents(3, [DIAG_CH_SEND_SUCCESS]);
        // Wait for a couple metric intervals before proceeding, so that
        // already recording metrics can be excluded in tests.
        const metricInterval = Number(
            process.env.OTEL_METRIC_EXPORT_INTERVAL || 30000
        );
        await setTimeout(metricInterval * 2);
    }

    // Phase B: should not see telemetry from instrumentations.
    await tracer.startActiveSpan('b', async (span) => {
        for await (let thing of allTheThings) {
            await thing.use(thing.state, 'b');
        }
        span.end();
    });

    await tracer.startActiveSpan('teardown', async (span) => {
        for await (let thing of allTheThings) {
            await thing.teardown?.(thing.state);
            delete thing.state;
        }
        span.end();
    });

    clearInterval(keepAlive);
}

main();
