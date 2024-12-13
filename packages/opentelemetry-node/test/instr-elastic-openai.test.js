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

const http = require('http');
const test = require('tape');
const {runTestFixtures, assertDeepMatch} = require('./testutils');

const skip = process.env.TEST_GENAI_MODEL === undefined;
if (skip) {
    console.log(
        '# SKIP elastic openai tests: TEST_GENAI_MODEL is not set (load env from test/test-services.env)'
    );
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-elastic-openai.js (CommonJS)',
        args: ['./fixtures/use-elastic-openai.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
        // verbose: true,
        checkTelemetry: (t, col) => {
            // Expected a trace like this:
            //        span 7e8ca8 "embeddings all-minilm:22m" (26.4ms, SPAN_KIND_CLIENT, GenAI openai)
            //   +9ms `- span 39fc32 "POST" (16.7ms, SPAN_KIND_CLIENT, POST http://127.0.0.1:11434/v1/embeddings -> 200)
            const spans = col.sortedSpans;
            assertDeepMatch(
                t,
                spans,
                [
                    {
                        name: `embeddings ${process.env.TEST_GENAI_MODEL}`,
                        kind: 'SPAN_KIND_CLIENT',
                        attributes: {
                            'gen_ai.operation.name': 'embeddings',
                            'gen_ai.request.model':
                                process.env.TEST_GENAI_MODEL,
                            'gen_ai.system': 'openai',
                        },
                        events: [],
                        scope: {
                            name: '@elastic/opentelemetry-instrumentation-openai',
                        },
                    },
                    {
                        name: 'POST',
                        parentSpanId: spans[0].spanId,
                        attributes: {
                            'http.target': '/v1/embeddings',
                        },
                        scope: {
                            name: '@opentelemetry/instrumentation-http',
                        },
                    },
                ],
                'spans'
            );
        },
    },

    // TODO: ESM test, requires `createAddHookMessageChannel` IITM work
];

// Basically do this:
//  curl -i http://localhost:11434/api/pull -d '{"model": "$TEST_GENAI_MODEL"}'
async function testModelIsPulled() {
    return new Promise((resolve, reject) => {
        const u = new URL(process.env.OPENAI_BASE_URL);
        const req = http.request(
            {
                hostname: u.hostname,
                port: u.port,
                path: '/api/pull',
                method: 'POST',
            },
            (res) => {
                // This is lazy error handling. We should watch for the response
                // data ending with `{"status":"success"}`.
                res.resume();
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        reject(
                            new Error(
                                `unexpected status code from Ollama: ${res.statusCode}`
                            )
                        );
                    } else {
                        resolve();
                    }
                });
            }
        );
        req.on('error', reject);
        req.write(JSON.stringify({model: process.env.TEST_GENAI_MODEL}));
        req.end();
    });
}

test('elastic openai instrumentation', {skip}, async (suite) => {
    suite.comment(`pulling test GenAI model (${process.env.TEST_GENAI_MODEL})`);
    await testModelIsPulled();

    runTestFixtures(suite, testFixtures);
    suite.end();
});
