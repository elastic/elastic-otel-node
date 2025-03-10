/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const { createOpenAIClient, runFnWithNockBack } = require('../testutils');

// Example from https://platform.openai.com/docs/guides/function-calling?lang=node.js
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_delivery_date',
      description:
        "Get the delivery date for a customer's order. Call this whenever you need to know the delivery date, for example when a customer asks 'Where is my package'",
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: "The customer's order ID.",
          },
        },
        required: ['order_id'],
        additionalProperties: false,
      },
    },
  },
];

async function main() {
  const client = createOpenAIClient();
  const messages = [
    {
      role: 'system',
      content:
        'You are a helpful customer support assistant. Use the supplied tools to assist the user.',
    },
    {
      role: 'user',
      content: 'Hi, can you tell me the delivery date for my order?',
    },
    {
      role: 'assistant',
      content:
        'Hi there! I can help with that. Can you please provide your order ID?',
    },
    { role: 'user', content: 'i think it is order_12345' },
  ];
  const response = await client.chat.completions.create({
    model: process.env.TEST_CHAT_MODEL,
    messages: messages,
    tools: tools,
  });
  console.dir(response, { depth: 50 });
}

if (process.env.TEST_NOCK_BACK_MODE) {
  runFnWithNockBack(
    main,
    process.env.TEST_FIXTURE_RECORDING_NAME,
    process.env.TEST_NOCK_BACK_MODE
  );
} else {
  main();
}
