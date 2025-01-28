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

// Usage: node -r @elastic/opentelemetry-node use-kafkajs.js

const otel = require('@opentelemetry/api');
const {Kafka} = require('kafkajs');

const clientId = process.env.TEST_KAFKAJS_CLIENT_ID || 'test-kafkajs-client';
const broker = process.env.TEST_KAFKAJS_HOST || 'localhost:9092';
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
