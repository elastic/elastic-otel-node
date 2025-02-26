/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const { createOpenAIClient, runFnWithNockBack } = require('../testutils');

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
        required: ['location'],
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
      content: 'You are a helpful assistant providing weather updates.',
    },
    { role: 'user', content: 'What is the weather in New York and London?' },
  ];
  const stream = await client.chat.completions.create({
    model: process.env.TEST_CHAT_MODEL,
    messages: messages,
    stream: true,
    stream_options: {
      include_usage: true,
    },
    tools: tools,
  });
  for await (const chunk of stream) {
    console.dir(chunk, { depth: 50 });
  }
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
