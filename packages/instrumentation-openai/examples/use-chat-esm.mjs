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
            'Answer in up to 3 words: Which ocean contains the falkland islands?',
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
