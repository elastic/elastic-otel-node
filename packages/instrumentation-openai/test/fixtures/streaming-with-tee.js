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
    // Ollama doesn't support stream_options.
    stream_options: {
      include_usage: true,
    },
  });

  // Use `stream.tee()` to ensure it works when instrumented.
  const [left, right] = stream.tee();
  for await (const chunk of left) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }
  process.stdout.write('\n');
  for await (const chunk of right) {
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
