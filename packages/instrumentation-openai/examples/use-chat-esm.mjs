/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// An example using `openai` in ESM code.
// See ESM section in README for details and limitations.
//
// Usage with OpenAI:
//    OPENAI_API_KEY=... \
//      node -r ./telemetry.mjs use-chat-esm.mjs

// Dev Note: Not using local ./openai.js utility for now, because CommonJS.
import { OpenAI } from 'openai';

const CHAT_MODEL = process.env.CHAT_MODEL || 'gpt-4o-mini';

async function main() {
  const client = new OpenAI();
  try {
    const chatCompletion = await client.chat.completions.create({
      model: CHAT_MODEL,
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
