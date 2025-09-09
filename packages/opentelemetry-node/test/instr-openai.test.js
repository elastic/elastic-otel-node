/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const http = require('http');
const {basename} = require('path');
const test = require('tape');
const semver = require('semver');
const {runTestFixtures, assertDeepMatch} = require('./testutils');

let skip = process.env.TEST_GENAI_MODEL === undefined;
if (skip) {
    console.log(
        '# SKIP openai tests: TEST_GENAI_MODEL is not set (load env from test/test-services.env)'
    );
} else {
    skip = !semver.satisfies(process.version, '>=18');
    if (skip) {
        console.log('# SKIP openai requires node >=18');
    }
}

/** @type {import('./testutils').TestFixture[]} */
const testFixtures = [
    {
        name: 'use-openai.js (CommonJS)',
        args: ['./fixtures/use-openai.js'],
        cwd: __dirname,
        env: {
            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
        },
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
                            name: '@opentelemetry/instrumentation-openai',
                        },
                    },
                    {
                        name: 'POST',
                        parentSpanId: spans[0].spanId,
                        attributes: {
                            'url.full': 'http://127.0.0.1:11434/v1/embeddings',
                        },
                        scope: {
                            name: '@opentelemetry/instrumentation-undici',
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
