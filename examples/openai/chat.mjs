/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {OpenAI} from 'openai';

let chatModel = process.env.CHAT_MODEL ?? 'gpt-4o-mini';

const client = new OpenAI();
const completion = await client.chat.completions.create({
  model: chatModel,
  messages: [
    {
      role: 'user',
      content: 'Answer in up to 3 words: Which ocean contains Bouvet Island?',
    },
  ],
});
console.log(completion.choices[0].message.content);
