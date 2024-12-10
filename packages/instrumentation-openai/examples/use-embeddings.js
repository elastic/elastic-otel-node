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

// Example usage with Ollama local server:
//    ollama serve
//    ollama pull all-minilm:33m
//    OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=unused node -r ./telemetry.js use-embeddings.js

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
