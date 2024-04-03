// Usage: node -r ../../start.js use-mongodb.js

const otel = require('@opentelemetry/api');
const {MongoClient} = require('mongodb');

const host = process.env.MONGODB_HOST;
const port = process.env.MONGODB_PORT;

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
