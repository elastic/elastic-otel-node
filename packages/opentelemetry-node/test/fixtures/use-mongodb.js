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

// Usage: node -r ../../start.js use-mongodb.js

const otel = require('@opentelemetry/api');
const {MongoClient} = require('mongodb');

const host = process.env.MONGODB_HOST;
const port = process.env.MONGODB_PORT || '27017';

async function main() {
    const url = `mongodb://${host}:${port}`;
    const mongodbClient = new MongoClient(url, {
        serverSelectionTimeoutMS: 3000,
    });

    await mongodbClient.connect();

    const database = mongodbClient.db('test-db');
    const collection = database.collection('test-col');

    // https://mongodb.github.io/node-mongodb-native/4.7/classes/Collection.html#insertMany
    let data = await collection.insertMany([{a: 1}, {a: 2}, {a: 3}], {
        w: 1,
    });
    console.log('Collection insert', data);

    // https://mongodb.github.io/node-mongodb-native/4.7/classes/Collection.html#deleteMany
    data = await collection.deleteMany({a: {$lte: 3}}, {w: 1});
    console.log('Collection delete', data);

    await mongodbClient.close();
}

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-parent-span', (span) => {
    main();
    span.end();
});
