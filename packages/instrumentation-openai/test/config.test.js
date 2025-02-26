/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
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
