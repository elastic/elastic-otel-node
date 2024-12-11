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

const assert = require('assert/strict');
const OpenAI = require('openai');

const MODEL =
  process.env.MODEL ||
  (process.env.OPENAI_BASE_URL ? 'qwen2.5:0.5b' : 'gpt-4o-mini');
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
  const client = new OpenAI();
  const messages = [
    {
      role: 'system',
      content: 'You are a helpful assistant providing weather updates.',
    },
    { role: 'user', content: 'What is the weather in New York and London?' },
  ];
  const stream = await client.chat.completions.create({
    model: MODEL,
    messages: messages,
    stream: true,
    stream_options: { include_usage: true },
    tools: tools,
  });

  let n = 0;
  let mode = null;
  function switchMode(newMode) {
    if (mode === 'content' && newMode !== 'content') {
      process.stdout.write('\n');
    } else if (mode === 'tool_call') {
      process.stdout.write(')\n');
    }
    mode = newMode;
  }

  for await (const chunk of stream) {
    // console.log('\n'); console.dir(chunk, { depth: 50 }); // debug print
    if (n === 0) {
      console.log('# response id:', chunk.id);
      console.log('# response model:', chunk.model);
    }
    if (chunk.usage) {
      // A final chunk included iff `stream_options.include_usage`.
      console.log('# usage:', chunk.usage);
      continue;
    }
    assert.equal(chunk.choices.length, 1);
    const delta = chunk.choices[0].delta;
    if (chunk.choices[0].finish_reason) {
      switchMode(null);
      console.log('# finish reason:', chunk.choices[0].finish_reason);
    } else if (delta.role === 'assistant') {
      if (typeof delta.content === 'string') {
        switchMode('content');
        process.stdout.write(delta.content);
      }
    } else if (delta.tool_calls) {
      assert.equal(delta.tool_calls.length, 1);
      const tc = delta.tool_calls[0];
      if (tc.id) {
        // First chunk in a tool call.
        assert.equal(tc.type, 'function');
        switchMode('tool_call');
        console.log('# tool call id:', tc.id);
        process.stdout.write(tc.function.name + '(');
      }
      process.stdout.write(tc.function.arguments);
    } else {
      throw new Error(`unexpected chunk: ${JSON.stringify(chunk)}`);
    }
    n++;
  }
}

main();