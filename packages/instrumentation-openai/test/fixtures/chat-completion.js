/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const { createOpenAIClient, runFnWithNockBack } = require('../testutils');

async function main() {
  const client = createOpenAIClient();
  const messages = [
    {
      role: 'user',
      content: 'Answer in up to 3 words: Which ocean contains Bouvet Island?',
    },
  ];
  const chatCompletion = await client.chat.completions.create({
    model: process.env.TEST_CHAT_MODEL,
    // `max_tokens` because AzureOpenAI does not support max_completions_tokens,
    // as of `OPENAI_API_VERSION=2024-10-01-preview`.
    //
    // A value of 200 was chosen to be large enough to not accidentally be a
    // `finish_reason` when using a model that ignores the "3 words" limit
    // and actually uses many tokens in the response. This case was
    // anecdotally with `ghcr.io/elastic/ollama/ollama:testing` and
    // model "qwen2.5:0.5b" twice, but was not thoroughly investigated.
    max_tokens: 200,
    messages,
  });
  console.log(chatCompletion.choices[0].message.content);
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
