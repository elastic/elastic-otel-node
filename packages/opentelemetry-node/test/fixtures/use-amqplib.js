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

// Usage: node -r @elastic/opentelemetry-node use-amqplib.js

const amqplib = require('amqplib');

const host = process.env.RABBITMQ_HOST;
const port = process.env.RABBITMQ_PORT || 22221;
const user = process.env.RABBITMQ_USER || 'username';
const pass = process.env.RABBITMQ_PASS || 'password';
const rabbitMqUrl = `amqp://${user}:${pass}@${host}:${port}`;

async function main() {
    const queueName = 'edot-test';
    const message = 'test message';
    const conn = await amqplib.connect(rabbitMqUrl);
    const channel = await conn.createChannel();

    await channel.assertQueue(queueName, {durable: false});
    await channel.purgeQueue(queueName);

    console.log('sending message %s to queue %s', message, queueName);
    channel.sendToQueue(queueName, Buffer.from(message));

    console.log('awaiting message from queue %s', queueName);
    await new Promise((resolve) => {
        channel.consume(queueName, (msg) => {
            console.log('message from queue %s received: %o', queueName, msg);
            resolve();
        });
    });

    await new Promise((resolve) => {
        channel.on('close', resolve);
        channel.close();
    });
    await conn.close();
}

main();
