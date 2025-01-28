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

// Usage: node -r @elastic/opentelemetry-node use-mongoose.js

const otel = require('@opentelemetry/api');
const {Schema, connect, model} = require('mongoose');

const host = process.env.MONGODB_HOST;
const port = process.env.MONGODB_PORT || '27017';

async function main() {
    const User = model(
        'User',
        new Schema({
            email: {type: String, required: true, unique: true},
            name: {type: String, required: true},
            age: {type: Number, required: false},
        })
    );

    const user = new User({
        email: 'john.doe@example.com',
        name: 'John Doe',
        age: 18,
    });

    const connection = await connect(`mongodb://${host}:${port}`, {
        dbName: 'edot_test',
    });

    await user.save();
    console.log('user saved', user.toJSON());
    await User.collection.drop();
    await connection.disconnect();
}

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-parent-span', async (span) => {
    await main();
    span.end();
});
