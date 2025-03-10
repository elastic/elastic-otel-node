/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage with OpenAI:
//    OPENAI_API_KEY=... \
//      node -r ./telemetry.js use-embeddings.js

const { newOpenAIAndModels } = require('./openai');

async function main() {
  const { client, embeddingsModel } = newOpenAIAndModels();
  const embedding = await client.embeddings.create({
    model: embeddingsModel,
    input: 'The quick brown fox jumped over the lazy dog',
    encoding_format: 'float',
  });
  console.log('Embeddings:');
  console.dir(embedding, { depth: 50 });
}

main();
