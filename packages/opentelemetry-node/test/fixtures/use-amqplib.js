/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
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
