/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
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
