/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const { createOpenAIClient, runFnWithNockBack } = require('../testutils');

async function main() {
  const client = createOpenAIClient();
  const stream = await client.chat.completions.create({
    model: process.env.TEST_CHAT_MODEL,
    messages: [
      {
        role: 'user',
        content: 'Answer in up to 3 words: Which ocean contains Bouvet Island?',
      },
    ],
    stream: true,
    // Note for testing: Ollama doesn't yet support stream_options.
    // See https://github.com/ollama/ollama/issues/5200
    stream_options: {
      include_usage: true,
    },
  });
  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }
  process.stdout.write('\n');
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
