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

// https://platform.openai.com/docs/guides/function-calling/configuring-parallel-function-calling

const { newOpenAIAndModels } = require('./openai');

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
          unit: { type: 'string', enum: ['c', 'f'] },
        },
        required: ['location', 'unit'],
        additionalProperties: false,
      },
    },
  },
];

async function main() {
  const { client, chatModel } = newOpenAIAndModels();

  const messages = [
    {
      role: 'system',
      content: 'You are a helpful assistant providing weather updates.',
    },
    {
      role: 'user',
      content: 'Can you tell me the weather in New York, London, and Tokyo?',
    },
  ];

  const response = await client.chat.completions.create({
    model: chatModel,
    messages: messages,
    tools: tools,
  });

  const toolCalls = response.choices[0].message.tool_calls;
  if (!toolCalls) {
    console.log('No tool calls were returned by the model.');
    return;
  }

  // A tool call is a request to execute a function. Print what would be invoked.
  for (const toolCall of toolCalls) {
    console.log(
      `${toolCall.id} -> ${toolCall.function.name}(${toolCall.function.arguments})`
    );
  }
}

main();
