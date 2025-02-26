/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
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
