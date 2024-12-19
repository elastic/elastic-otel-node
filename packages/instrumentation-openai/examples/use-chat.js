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

// A very basic example using the OpenAI client.
//
// Usage with OpenAI:
//    OPENAI_API_KEY=... \
//      node -r ./telemetry.js use-chat.js
//
// Usage with a local Ollama server:
//    ollama serve
//    ollama pull qwen2.5:0.5b
//    OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=unused \
//      node -r ./telemetry.js use-chat.js

const { newOpenAIAndModels } = require('./openai');

async function main() {
  const { client, chatModel } = newOpenAIAndModels();
  try {
    const chatCompletion = await client.chat.completions.create({
      model: chatModel,
      messages: [
        {
          role: 'user',
          content:
            'Answer in up to 3 words: Which ocean contains Bouvet Island?',
        },
      ],
    });
    console.log(chatCompletion.choices[0].message.content);
  } catch (err) {
    console.log('chat err:', err);
    process.exitCode = 1;
  }
}

main();
