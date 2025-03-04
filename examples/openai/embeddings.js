/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {OpenAI} = require('openai');
const {dot, norm} = require('mathjs');

let embeddingsModel = process.env.EMBEDDINGS_MODEL ?? 'text-embedding-3-small';

async function main() {
  const client = new OpenAI();

  const products = [
    "Search: Ingest your data, and explore Elastic's machine learning and retrieval augmented generation (RAG) capabilities.",
    'Observability: Unify your logs, metrics, traces, and profiling at scale in a single platform.',
    'Security: Protect, investigate, and respond to cyber threats with AI-driven security analytics.',
    'Elasticsearch: Distributed, RESTful search and analytics.',
    'Kibana: Visualize your data. Navigate the Stack.',
    'Beats: Collect, parse, and ship in a lightweight fashion.',
    'Connectors: Connect popular databases, file systems, collaboration tools, and more.',
    'Logstash: Ingest, transform, enrich, and output.',
  ];

  // Generate embeddings for each product. Keep them in an array instead of a vector DB.
  const productEmbeddings = [];
  for (const product of products) {
    productEmbeddings.push(await createEmbedding(client, product));
  }

  const queryEmbedding = await createEmbedding(
    client,
    'What can help me connect to a database?'
  );

  // Calculate cosine similarity between the query and document embeddings
  const similarities = productEmbeddings.map((productEmbedding) => {
    return (
      dot(queryEmbedding, productEmbedding) /
      (norm(queryEmbedding) * norm(productEmbedding))
    );
  });

  // Get the index of the most similar document
  const mostSimilarIndex = similarities.indexOf(Math.max(...similarities));

  console.log(products[mostSimilarIndex]);
}

async function createEmbedding(client, text) {
  const response = await client.embeddings.create({
    input: [text],
    model: embeddingsModel,
    encoding_format: 'float',
  });
  return response.data[0].embedding;
}

main();
