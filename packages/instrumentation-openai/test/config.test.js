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

const test = require('tape');
const { OpenAIInstrumentation } = require('../'); // @elastic/opentelemetry-instrumentation-openai

test('config', async suite => {
  suite.test('default config', t => {
    const instr = new OpenAIInstrumentation();
    t.deepEqual(instr.getConfig(), {
      enabled: true,
      captureMessageContent: false,
    });
    t.end();
  });

  suite.test('param captureMessageContent', t => {
    let instr = new OpenAIInstrumentation({ captureMessageContent: true });
    t.deepEqual(instr.getConfig().captureMessageContent, true);

    instr = new OpenAIInstrumentation({ captureMessageContent: false });
    t.deepEqual(instr.getConfig().captureMessageContent, false);

    instr = new OpenAIInstrumentation({
      captureMessageContent: 'some-truthy-value',
    });
    t.deepEqual(instr.getConfig().captureMessageContent, true);

    instr = new OpenAIInstrumentation({
      captureMessageContent: 0, // a non-bool falsy value
    });
    t.deepEqual(instr.getConfig().captureMessageContent, false);

    t.end();
  });

  suite.test('envvar OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT', t => {
    process.env.OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT = 'true';
    let instr = new OpenAIInstrumentation();
    t.deepEqual(instr.getConfig().captureMessageContent, true);

    process.env.OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT = 'false';
    instr = new OpenAIInstrumentation();
    t.deepEqual(instr.getConfig().captureMessageContent, false);

    // envvar wins over param.
    process.env.OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT = 'false';
    instr = new OpenAIInstrumentation({ captureMessageContent: true });
    t.deepEqual(instr.getConfig().captureMessageContent, false);

    // Bogus envvar value is ignored.
    process.env.OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT = 'bogus';
    instr = new OpenAIInstrumentation({ captureMessageContent: true });
    t.deepEqual(instr.getConfig().captureMessageContent, true);

    delete process.env.OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT;
    t.end();
  });

  suite.test('setConfig', t => {
    process.env.OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT = 'true';
    let instr = new OpenAIInstrumentation();
    t.deepEqual(instr.getConfig(), {
      enabled: true,
      captureMessageContent: true,
    });

    instr.setConfig({
      captureMessageContent: false,
    });
    t.deepEqual(instr.getConfig(), {
      enabled: true,
      captureMessageContent: false,
    });

    delete process.env.OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT;
    t.end();
  });

  suite.end();
});
