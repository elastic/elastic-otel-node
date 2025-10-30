/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Usage with ollama local server:
 *      npm run test-services:start ollama
 *      docker exec -ti edot-nodejs-test-services-ollama-1 ollama pull all-minilm:22m
 *      node --env-file ./test/test-services.env -r @elastic/opentelemetry-node test/fixtures/use-openai.js
 *      npm run test-services:stop
 */

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
