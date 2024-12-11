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
  // default to models available in both the OpenAI platform and Azure OpenAI Service
  let chatModel = process.env.MODEL_CHAT ?? 'gpt-4o-mini';
  let embeddingsModel =
    process.env.MODEL_EMBEDDINGS ?? 'text-embedding-3-small';

  if (process.env.AZURE_OPENAI_API_KEY) {
    clientCtor = AzureOpenAI;
  } else if (
    process.env.OPENAI_BASE_URL &&
    new URL(process.env.OPENAI_BASE_URL).port === OLLAMA_PORT
  ) {
    process.env.OPENAI_API_KEY = 'unused';
    // Note: Others like LocalAI do not use Ollama's naming scheme.
    chatModel = process.env.MODEL_CHAT ?? 'qwen2.5:0.5b';
    embeddingsModel = process.env.MODEL_EMBEDDINGS ?? 'all-minilm:33m';
  }

  return { client: new clientCtor(), chatModel, embeddingsModel };
}

module.exports = { newOpenAIAndModels };
