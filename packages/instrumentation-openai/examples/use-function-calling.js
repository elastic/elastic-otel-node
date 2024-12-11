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

const { newOpenAIAndModels } = require('./openai');

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
  const { client, chatModel } = newOpenAIAndModels();

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
    model: chatModel,
    messages: messages,
    tools: tools,
  });

  // A tool call is a request to execute a function. Print what would be invoked.
  const toolCalls = response.choices[0].message.tool_calls;
  if (!toolCalls) {
    console.log('No tool calls were returned by the model.');
    return;
  }
  const toolCall = toolCalls[0];
  console.log(
    `${toolCall.id} -> ${toolCall.function.name}(${toolCall.function.arguments})`
  );
}

main();