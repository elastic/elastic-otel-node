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
    model: process.env.TEST_MODEL_TOOLS,
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
