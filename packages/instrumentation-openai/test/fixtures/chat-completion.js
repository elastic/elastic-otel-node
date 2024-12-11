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

const { createOpenAIClient, runFnWithNockBack } = require('../testutils');

async function main() {
  const client = createOpenAIClient();
  const messages = [
    {
      role: 'user',
      content:
        'Answer in up to 3 words: Which ocean contains the falkland islands?',
    },
  ];
  const chatCompletion = await client.chat.completions.create({
    model: process.env.TEST_MODEL_TOOLS,
    // `max_tokens` because AzureOpenAI still does not support max_completions_tokens.
    //
    // A value of 200 was chosen to be large enough to not accidentally be a
    // `finish_reason` when using a model that ignores the "3 words" limit
    // and actually uses many tokens in the response. This case was
    // anecdotally with `ghcr.io/elastic/ollama/ollama:testing` and
    // model "qwen2.5:0.5b" twice, but was not thoroughly investigated.
    max_tokens: 200,
    messages,
  });
  console.log(chatCompletion.choices[0].message.content);
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
