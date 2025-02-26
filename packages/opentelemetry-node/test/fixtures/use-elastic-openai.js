/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage:
//      node --env-file ./test-services.env -r @elastic/opentelemetry-node fixtures/use-elastic-openai.js

const {OpenAI} = require('openai');

async function main() {
    const client = new OpenAI();
    const embedding = await client.embeddings.create({
        model: process.env.TEST_GENAI_MODEL,
        input: 'Blah blah blah',
        encoding_format: 'float',
    });
    console.log('Embeddings:');
    console.dir(embedding, {depth: 50});
}

main();
