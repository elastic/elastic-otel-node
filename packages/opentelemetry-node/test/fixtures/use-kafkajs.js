/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node --env-file ../test-services.env -r @elastic/opentelemetry-node use-kafkajs.js

const otel = require('@opentelemetry/api');
const {Kafka} = require('kafkajs');

const host = process.env.KAFKA_HOST;
const port = process.env.KAFKA_PORT || '9094';
const broker = `${host}:${port}`;
const clientId = process.env.TEST_KAFKAJS_CLIENT_ID || 'test-kafkajs-client';
const topic =
    process.env.TEST_KAFKAJS_TOPIC ||
    `test-${Math.floor(Math.random() * 1000)}`;

async function main() {
    const kafkaClient = new Kafka({clientId, brokers: [broker]});

    const admin = kafkaClient.admin();
    const producer = kafkaClient.producer();

    // Create the topics & subscribe
    await admin.connect();
    await admin.createTopics({
        waitForLeaders: true,
        topics: [{topic}],
    });
    console.log('topic created');

    await producer.connect();
    const data = await producer.send({
        topic,
        messages: [
            {value: 'message 1', headers: {foo: 'foo 1'}},
            {value: 'message 2', headers: {foo: Buffer.from('foo 2')}},
        ],
    });
    console.log({data}, 'messages sent');
    await producer.disconnect();
    console.log('producer disconnect');
    await admin.deleteTopics({topics: [topic]});
    console.log('topics deleted');
    await admin.disconnect();
    console.log('admin disconnect');
}

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-parent-span', (span) => {
    main();
    span.end();
});
