/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const { createOpenAIClient, runFnWithNockBack } = require('../testutils');

async function main() {
  const client = createOpenAIClient();
  const embedding = await client.embeddings.create({
    model: process.env.TEST_EMBEDDINGS_MODEL,
    input: ['One fish', 'two fish', 'red fish', 'blue fish'],
    encoding_format: 'float',
  });
  console.log('Embeddings:');
  console.dir(embedding, { depth: 50 });
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
