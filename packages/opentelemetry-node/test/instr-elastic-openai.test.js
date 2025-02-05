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
const {basename} = require('path');
const test = require('tape');
// const semver = require('semver');
const {runTestFixtures, assertDeepMatch} = require('./testutils');

let skip = true;
console.log(
    '# SKIP elastic/instr-openai test until https://github.com/ollama/ollama/issues/8400 is resolved'
);
// let skip = process.env.TEST_GENAI_MODEL === undefined;
// if (skip) {
//     console.log(
//         '# SKIP elastic openai tests: TEST_GENAI_MODEL is not set (load env from test/test-services.env)'
//     );
// } else {
//     skip = !semver.satisfies(process.version, '>=18');
//     if (skip) {
//         console.log('# SKIP elastic openai requires node >=18');
//     }
// }

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
                if (res.statusCode !== 200) {
                    reject(
                        new Error(
                            `unexpected status code from Ollama: ${res.statusCode}`
                        )
                    );
                    res.resume();
                    return;
                }

                // If the pull is successful, the last line of the body will
                // be: `{"status":"success"}`.  Otherwise, typically the last
                // line indicates the error.
                const chunks = [];
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                res.on('end', () => {
                    const body = Buffer.concat(chunks).toString('utf8');
                    const lastLine = body.trim().split(/\n/g).slice(-1)[0];
                    if (lastLine === '{"status":"success"}') {
                        resolve();
                    } else {
                        reject(
                            new Error(
                                `could not pull "${process.env.TEST_GENAI_MODEL}" model: lastLine=${lastLine}`
                            )
                        );
                    }
                });
            }
        );
        req.on('error', reject);
        req.write(JSON.stringify({model: process.env.TEST_GENAI_MODEL}));
        req.end();
    });
}

test(basename(__filename), {skip}, async (t) => {
    t.comment(`pulling test GenAI model (${process.env.TEST_GENAI_MODEL})`);
    let isPulled = false;
    const startTime = new Date();
    try {
        await testModelIsPulled();
        isPulled = true;
        const deltaS = Math.round((new Date() - startTime) / 1000);
        t.comment(`successfully pulled model (${deltaS}s)`);
    } catch (pullErr) {
        t.error(pullErr);
    }

    if (isPulled) {
        runTestFixtures(t, testFixtures);
    }
    t.end();
});
