/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const { OpenAI, AzureOpenAI } = require('openai');

const OLLAMA_PORT = '11434';

/**
 * Returns an OpenAI client and model to use with it, based on env variables.
 *
 * @typedef {Object} OpenAIAndModels
 * @property {OpenAI} client - The OpenAI client instance.
 * @property {string} chatModel - The chat model name.
 * @property {string} embeddingsModel - The embeddings model name.
 * @returns {OpenAIAndModels} Contains the OpenAI client and models to use.
 */
function newOpenAIAndModels() {
  let clientCtor = OpenAI;
  // Default to models available in both the OpenAI platform and Azure OpenAI
  // Service. For Azure, however, this "model" must match the Azure "deployment
  // name".
  let chatModel = process.env.CHAT_MODEL ?? 'gpt-4o-mini';
  let embeddingsModel =
    process.env.EMBEDDINGS_MODEL ?? 'text-embedding-3-small';

  if (process.env.AZURE_OPENAI_API_KEY) {
    clientCtor = AzureOpenAI;
  } else if (
    process.env.OPENAI_BASE_URL &&
    new URL(process.env.OPENAI_BASE_URL).port === OLLAMA_PORT
  ) {
    process.env.OPENAI_API_KEY = 'unused';
    // Note: Others like LocalAI do not use Ollama's naming scheme.
    chatModel = process.env.CHAT_MODEL ?? 'qwen2.5:0.5b';
    embeddingsModel = process.env.EMBEDDINGS_MODEL ?? 'all-minilm:33m';
  }

  return { client: new clientCtor(), chatModel, embeddingsModel };
}

module.exports = { newOpenAIAndModels };
