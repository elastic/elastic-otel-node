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

/**
 * Run test fixtures.
 *
 * A test fixture is:
 * 1. one of the entries in the `testFixtures` array below, which defines
 * 2. a script in test/fixtures/ to exec, and
 * 3. a set of assertions to make on the telemetry from that process run.
 *
 * For each fixture, the script is run with OTel instrumentation and a mock OTel
 * collector, and then assertions are checked.
 *
 * This test file is used for "unit" (TEST_FIXTURES_MODE=unit, the default) and
 * "integration" (TEST_FIXTURES_MODE=integration) tests. The unit tests use
 * pre-recorded responses from OpenAI (see test/fixtures/nock-recordings/).
 * The integration tests run
 *
 * # Configuration environment variables
 *
 * - TEST_FIXTURES_MODE: "unit", "integration", or "regenerate-recordings"
 * - TEST_FIXTURES_ENV_FILE: Set this to a *.env file path to have it loaded by
 *   dotenv. This exists as a convenience because using dotenv on the CLI is
 *   cumbersome.
 *
 * The following envvars are only used for integration tests.
 *
 * - TEST_CHAT_MODEL: The name of the GenAI model to use for most tests. It
 *   must support tool/function-calling.
 *   https://platform.openai.com/docs/guides/function-calling
 * - TEST_EMBEDDINGS_MODEL: The name of the GenAI model to use for embeddings
 *   tests. https://platform.openai.com/docs/guides/embeddings
 * - `openai` client library envvars: OPENAI_BASE_URL, OPENAI_API_KEY,
 *    AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY. If AZURE_OPENAI_API_KEY is
 *    set, then the `openai.AzureOpenAI` client is used, otherwise
 *    `openai.OpenAI` is used.
 */

const test = require('tape');

// On semconv imports:
// - Read "src/semconv.ts" top-comment for why this instrumentation does not
//   have a *runtime* dep on `@opentelemetry/semantic-conventions`.
// - However, we *do* use the package in tests. This effectively is a check
//   that the constants in "src/semconv.ts" match the published package.
const {
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
} = require('@opentelemetry/semantic-conventions');
const {
  ATTR_EVENT_NAME,
  ATTR_GEN_AI_OPERATION_NAME,
  ATTR_GEN_AI_RESPONSE_FINISH_REASONS,
  ATTR_GEN_AI_REQUEST_MAX_TOKENS,
  ATTR_GEN_AI_REQUEST_MODEL,
  ATTR_GEN_AI_RESPONSE_ID,
  ATTR_GEN_AI_RESPONSE_MODEL,
  ATTR_GEN_AI_SYSTEM,
  ATTR_GEN_AI_TOKEN_TYPE,
  ATTR_GEN_AI_USAGE_INPUT_TOKENS,
  ATTR_GEN_AI_USAGE_OUTPUT_TOKENS,
  METRIC_GEN_AI_CLIENT_OPERATION_DURATION,
  METRIC_GEN_AI_CLIENT_TOKEN_USAGE,
} = require('@opentelemetry/semantic-conventions/incubating');
const {
  ATTR_GEN_AI_REQUEST_ENCODING_FORMATS,
  EVENT_GEN_AI_ASSISTANT_MESSAGE,
  EVENT_GEN_AI_CHOICE,
  EVENT_GEN_AI_SYSTEM_MESSAGE,
  EVENT_GEN_AI_USER_MESSAGE,
} = require('../build/src/semconv');

const {
  assertDeepMatch,
  runTestFixtures,
  findObjInArray,
} = require('./testutils');

// Convenience to load a .env file.
//    TEST_FIXTURES_ENV_FILE=./my.env npm test
//
// This test can be configured with a number of environment variables. It is
// nice to specify those in a .env file. However, sometimes it is a pain to
// execute a node script or test file with a .env file.
// - This works with Node.js v20+, but not Node v18.
//      node --env-file ./my.env script.js
// - This works with all versions, but is wordy and obtuse:
//      NODE_OPTIONS='-r dotenv/config' DOTENV_CONFIG_PATH=./my.env npm run something
if (process.env.TEST_FIXTURES_ENV_FILE) {
  require('dotenv').config({ path: process.env.TEST_FIXTURES_ENV_FILE });
}

const UNIT_TEST_MODEL_TOOLS = 'gpt-4o-mini';
const UNIT_TEST_MODEL_EMBEDDINGS = 'text-embedding-3-small';

// Configure the test fixtures based on the test mode.
const testMode = process.env.TEST_FIXTURES_MODE || 'unit';
const isUnit = testMode === 'unit'; // shorthand for terser code below
// Nock is used for HTTP-mocking in some test modes. It interferes with
// `@opentelemetry/instrumentation-http`, so we skip assertions for HTTP
// spans when using nock.
let usingNock = false;
let targetService;

switch (testMode) {
  case 'unit':
    // Unit tests.
    // "unit" mode is for running using pre-recorded OpenAI API responses.
    // This is implemented using `nock`s "Nock back" feature.
    usingNock = true;
    // https://github.com/nock/nock#modes
    process.env.TEST_NOCK_BACK_MODE = 'lockdown';
    // OPENAI_API_KEY needs to be set to something to avoid OpenAI
    // constructor error. However, because of mocking, it isn't used.
    process.env.OPENAI_API_KEY = 'notused';
    process.env.TEST_CHAT_MODEL = UNIT_TEST_MODEL_TOOLS;
    process.env.TEST_EMBEDDINGS_MODEL = UNIT_TEST_MODEL_EMBEDDINGS;
    targetService = 'openai';
    break;

  case 'regenerate-recordings':
    // Regenerate the recorded OpenAI API responses use by "unit" test mode.
    if (process.env.OPENAI_BASE_URL) {
      throw new Error(
        'OPENAI_BASE_URL is set. To regenerate-recordings, it must be empty so that recorded responses are from api.openai.com'
      );
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY is not set. To regenerate-recordings, it must be set. Set it in your environment, or use TEST_FIXTURES_ENV_FILE="./openai.env" (see "openai.env.example").'
      );
    }
    usingNock = true;
    process.env.TEST_NOCK_BACK_MODE = 'update';
    process.env.TEST_CHAT_MODEL = UNIT_TEST_MODEL_TOOLS;
    process.env.TEST_EMBEDDINGS_MODEL = UNIT_TEST_MODEL_EMBEDDINGS;
    targetService = 'openai';
    break;

  case 'integration':
    // Guess the target service based on the config in the environment.
    // This is necessary because there some small differences between Azure
    // OpenAI, OpenAI, and Ollama that test assertions need to cope with.
    if (
      process.env.OPENAI_BASE_URL &&
      new URL(process.env.OPENAI_BASE_URL).port === '11434'
    ) {
      targetService = 'ollama';
    } else if (process.env.AZURE_OPENAI_API_KEY) {
      targetService = 'azure';
    } else {
      targetService = 'openai';
    }
    break;

  default:
    throw new Error('unknown test mode: ' + testMode);
}

// ---- helper functions

function isPositiveInteger(val) {
  return Number.isInteger(val) && val > 0;
}

function isExpectedServerAddress(val) {
  const baseUrl =
    (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) ||
    process.env.OPENAI_BASE_URL ||
    'https://api.openai.com';
  const expectedHostname = new URL(baseUrl).hostname;
  return val === expectedHostname;
}

function isExpectedServerPort(val) {
  if (targetService === 'openai') {
    return val === 443;
  } else if (targetService === 'azure') {
    let port = new URL(process.env.AZURE_OPENAI_ENDPOINT).port;
    port = port ? Number(port) : 443;
    return val == port;
  } else if (targetService === 'ollama') {
    return val === Number(new URL(process.env.OPENAI_BASE_URL).port);
  } else {
    return false;
  }
}

function isExpectedResponseModel(unitTestVal, requestModel) {
  return val => {
    if (isUnit) {
      return val === unitTestVal;
    } else if (process.env.AZURE_OPENAI_API_KEY) {
      // The Azure OpenAI API accepts a "model" argument that
      // actually refers to a deployment name. That deployment name
      // *might* match the model in that deployment, but that is
      // not at all a guarantee.
      return typeof val === 'string' && val.length > 0;
    } else {
      // Typically `$MODEL-$RELEASE_DATE` from api.openai.com.
      return val.startsWith(requestModel);
    }
  };
}

// ---- tests

test('fixtures', async suite => {
  /** @type {import('./testutils').TestFixture[]} */
  let testFixtures = [
    {
      name: 'chat-completion (captureMessageContent=true)',
      args: ['./fixtures/chat-completion.js'],
      cwd: __dirname,
      env: {
        NODE_OPTIONS: '--require=./fixtures/telemetry.js',
        OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT: 'true',
        TEST_FIXTURE_RECORDING_NAME: 'chat-completion',
      },
      verbose: true,
      checkTelemetry: (t, col, _stdout) => {
        const spans = col.sortedSpans;

        // Match a subset of the GenAI span fields.
        assertDeepMatch(
          t,
          spans[0],
          {
            name: `chat ${process.env.TEST_CHAT_MODEL}`,
            kind: 'SPAN_KIND_CLIENT',
            attributes: {
              [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
              [ATTR_GEN_AI_REQUEST_MODEL]: process.env.TEST_CHAT_MODEL,
              [ATTR_GEN_AI_SYSTEM]: 'openai',
              [ATTR_SERVER_ADDRESS]: isExpectedServerAddress,
              [ATTR_SERVER_PORT]: isExpectedServerPort,
              [ATTR_GEN_AI_REQUEST_MAX_TOKENS]: 200,
              [ATTR_GEN_AI_RESPONSE_FINISH_REASONS]: ['stop'],
              [ATTR_GEN_AI_RESPONSE_ID]: isUnit
                ? 'chatcmpl-AfbMVACkhZbXSJoCkCzhuGjI9hxi9'
                : /.+/,
              [ATTR_GEN_AI_RESPONSE_MODEL]: isExpectedResponseModel(
                'gpt-4o-mini-2024-07-18',
                process.env.TEST_CHAT_MODEL
              ),
              [ATTR_GEN_AI_USAGE_INPUT_TOKENS]: isUnit ? 22 : isPositiveInteger,
              [ATTR_GEN_AI_USAGE_OUTPUT_TOKENS]: isUnit ? 3 : isPositiveInteger,
            },
            scope: {
              name: '@elastic/opentelemetry-instrumentation-openai',
            },
          },
          'spans[0]'
        );

        if (!usingNock) {
          t.equal(spans[1].scope.name, '@opentelemetry/instrumentation-http');
          t.equal(
            spans[1].parentSpanId,
            spans[0].spanId,
            'HTTP span is a child of the GenAI span'
          );
          t.ok(
            spans[1].attributes['http.target'].includes('/chat/completions'),
            'looks like a .../chat/completions HTTP endpoint'
          );
        }

        assertDeepMatch(
          t,
          col.logs,
          [
            {
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_USER_MESSAGE,
              },
              body: {
                role: 'user',
                content:
                  'Answer in up to 3 words: Which ocean contains Bouvet Island?',
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
            {
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_CHOICE,
              },
              body: {
                finish_reason: 'stop',
                index: 0,
                message: {
                  content: isUnit ? 'Southern Ocean.' : /.+/,
                },
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
          ],
          'log events'
        );

        // Metrics
        let metric = findObjInArray(
          col.metrics,
          'name',
          METRIC_GEN_AI_CLIENT_OPERATION_DURATION
        );
        assertDeepMatch(
          t,
          metric,
          {
            name: METRIC_GEN_AI_CLIENT_OPERATION_DURATION,
            unit: 's',
            histogram: {
              dataPoints: [
                {
                  attributes: {
                    [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
                    [ATTR_GEN_AI_REQUEST_MODEL]: process.env.TEST_CHAT_MODEL,
                    [ATTR_GEN_AI_SYSTEM]: 'openai',
                    [ATTR_SERVER_ADDRESS]: isExpectedServerAddress,
                    [ATTR_SERVER_PORT]: isExpectedServerPort,
                    [ATTR_GEN_AI_RESPONSE_MODEL]: isExpectedResponseModel(
                      'gpt-4o-mini-2024-07-18',
                      process.env.TEST_CHAT_MODEL
                    ),
                  },
                },
              ],
            },
          },
          JSON.stringify(METRIC_GEN_AI_CLIENT_OPERATION_DURATION)
        );
        metric = findObjInArray(
          col.metrics,
          'name',
          METRIC_GEN_AI_CLIENT_TOKEN_USAGE
        );
        assertDeepMatch(
          t,
          metric,
          {
            name: METRIC_GEN_AI_CLIENT_TOKEN_USAGE,
            unit: '{token}',
            histogram: {
              dataPoints: [
                {
                  attributes: {
                    [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
                    [ATTR_GEN_AI_REQUEST_MODEL]: process.env.TEST_CHAT_MODEL,
                    [ATTR_GEN_AI_SYSTEM]: 'openai',
                    [ATTR_SERVER_ADDRESS]: isExpectedServerAddress,
                    [ATTR_SERVER_PORT]: isExpectedServerPort,
                    [ATTR_GEN_AI_RESPONSE_MODEL]: isExpectedResponseModel(
                      'gpt-4o-mini-2024-07-18',
                      process.env.TEST_CHAT_MODEL
                    ),
                    [ATTR_GEN_AI_TOKEN_TYPE]: 'input',
                  },
                },
                {
                  attributes: {
                    [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
                    [ATTR_GEN_AI_REQUEST_MODEL]: process.env.TEST_CHAT_MODEL,
                    [ATTR_GEN_AI_SYSTEM]: 'openai',
                    [ATTR_SERVER_ADDRESS]: isExpectedServerAddress,
                    [ATTR_SERVER_PORT]: isExpectedServerPort,
                    [ATTR_GEN_AI_RESPONSE_MODEL]: isExpectedResponseModel(
                      'gpt-4o-mini-2024-07-18',
                      process.env.TEST_CHAT_MODEL
                    ),
                    [ATTR_GEN_AI_TOKEN_TYPE]: 'output',
                  },
                },
              ],
            },
          },
          JSON.stringify(METRIC_GEN_AI_CLIENT_TOKEN_USAGE)
        );
      },
    },

    {
      // Same as the previous test case, except for the captureMessageContent
      // setting. Ensure that Opt-In telemetry values are *not* captured.
      name: 'chat-completion (captureMessageContent=false)',
      args: ['./fixtures/chat-completion.js'],
      cwd: __dirname,
      env: {
        NODE_OPTIONS: '--require=./fixtures/telemetry.js',
        TEST_FIXTURE_RECORDING_NAME: 'chat-completion',
      },
      checkTelemetry: (t, col, _stdout) => {
        assertDeepMatch(
          t,
          col.logs,
          [
            // Expect to *not* have a 'gen_ai.user.message' event. The only
            // field on that event is the "Opt-In" `content`.
            {
              attributes: {
                'event.name': EVENT_GEN_AI_CHOICE,
              },
              body: {
                finish_reason: 'stop',
                index: 0,
                message: {
                  content: undefined, // This must not be captured.
                },
              },
            },
          ],
          'log events'
        );
      },
    },

    {
      name: 'streaming-chat-completion',
      args: ['./fixtures/streaming-chat-completion.js'],
      cwd: __dirname,
      env: {
        NODE_OPTIONS: '--require=./fixtures/telemetry.js',
        OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT: 'true',
        TEST_FIXTURE_RECORDING_NAME: 'streaming-chat-completion',
      },
      verbose: true,
      checkTelemetry: (t, col, stdout) => {
        const spans = col.sortedSpans;

        // Match a subset of the GenAI span fields.
        assertDeepMatch(
          t,
          spans[0],
          {
            name: `chat ${process.env.TEST_CHAT_MODEL}`,
            kind: 'SPAN_KIND_CLIENT',
            attributes: {
              [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
              [ATTR_GEN_AI_REQUEST_MODEL]: process.env.TEST_CHAT_MODEL,
              [ATTR_GEN_AI_SYSTEM]: 'openai',
              [ATTR_GEN_AI_RESPONSE_FINISH_REASONS]: ['stop'],
              [ATTR_GEN_AI_RESPONSE_ID]: isUnit
                ? 'chatcmpl-AfbMVBL30VWqxHMtEWOUi1gulztS0'
                : /.+/,
              [ATTR_GEN_AI_RESPONSE_MODEL]: isExpectedResponseModel(
                'gpt-4o-mini-2024-07-18',
                process.env.TEST_CHAT_MODEL
              ),
              [ATTR_GEN_AI_USAGE_INPUT_TOKENS]: undefined,
              [ATTR_GEN_AI_USAGE_OUTPUT_TOKENS]: undefined,
            },
            scope: {
              name: '@elastic/opentelemetry-instrumentation-openai',
            },
          },
          'spans[0]'
        );

        if (!usingNock) {
          t.equal(spans[1].scope.name, '@opentelemetry/instrumentation-http');
          t.equal(
            spans[1].parentSpanId,
            spans[0].spanId,
            'HTTP span is a child of the GenAI span'
          );
          t.ok(
            spans[1].attributes['http.target'].includes('/chat/completions'),
            'looks like a .../chat/completions HTTP endpoint'
          );
        }

        assertDeepMatch(
          t,
          col.logs,
          [
            {
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_USER_MESSAGE,
              },
              body: {
                role: 'user',
                content:
                  'Answer in up to 3 words: Which ocean contains Bouvet Island?',
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
            {
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_CHOICE,
              },
              body: {
                finish_reason: 'stop',
                index: 0,
                message: { content: /.+/ },
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
          ],
          'log events'
        );

        // Metrics
        // Should not be a METRIC_GEN_AI_CLIENT_TOKEN_USAGE metric,
        // because this response does not include usage data.
        let metric = findObjInArray(
          col.metrics,
          'name',
          METRIC_GEN_AI_CLIENT_OPERATION_DURATION
        );
        assertDeepMatch(
          t,
          metric,
          {
            name: METRIC_GEN_AI_CLIENT_OPERATION_DURATION,
            unit: 's',
            histogram: {
              dataPoints: [
                {
                  attributes: {
                    [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
                    [ATTR_GEN_AI_REQUEST_MODEL]: process.env.TEST_CHAT_MODEL,
                    [ATTR_GEN_AI_SYSTEM]: 'openai',
                    [ATTR_SERVER_ADDRESS]: isExpectedServerAddress,
                    [ATTR_SERVER_PORT]: isExpectedServerPort,
                    [ATTR_GEN_AI_RESPONSE_MODEL]: isExpectedResponseModel(
                      'gpt-4o-mini-2024-07-18',
                      process.env.TEST_CHAT_MODEL
                    ),
                  },
                },
              ],
            },
          },
          JSON.stringify(METRIC_GEN_AI_CLIENT_OPERATION_DURATION)
        );
      },
    },

    {
      name: 'streaming-with-include_usage',
      args: ['./fixtures/streaming-with-include_usage.js'],
      cwd: __dirname,
      env: {
        NODE_OPTIONS: '--require=./fixtures/telemetry.js',
        OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT: 'true',
        TEST_FIXTURE_RECORDING_NAME: 'streaming-with-include_usage',
      },
      verbose: true,
      checkTelemetry: (t, col, stdout) => {
        const spans = col.sortedSpans;

        // Only bother to assert a few fields, because we expect mostly
        // the same telemetry as with "streaming-chat-completions.js".
        assertDeepMatch(
          t,
          spans[0],
          {
            name: `chat ${process.env.TEST_CHAT_MODEL}`,
            attributes: {
              [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
              [ATTR_GEN_AI_USAGE_INPUT_TOKENS]: isUnit ? 22 : isPositiveInteger,
              [ATTR_GEN_AI_USAGE_OUTPUT_TOKENS]: isUnit ? 4 : isPositiveInteger,
            },
          },
          'spans[0]'
        );

        // Metrics
        // Compared to the `streaming-chat-completion` test case, we
        // expect to have a METRIC_GEN_AI_CLIENT_TOKEN_USAGE metric now.
        let metric = findObjInArray(
          col.metrics,
          'name',
          METRIC_GEN_AI_CLIENT_OPERATION_DURATION
        );
        assertDeepMatch(
          t,
          metric,
          {
            name: METRIC_GEN_AI_CLIENT_OPERATION_DURATION,
            unit: 's',
            histogram: {
              dataPoints: [
                {
                  attributes: {
                    [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
                    [ATTR_GEN_AI_REQUEST_MODEL]: process.env.TEST_CHAT_MODEL,
                    [ATTR_GEN_AI_SYSTEM]: 'openai',
                    [ATTR_SERVER_ADDRESS]: isExpectedServerAddress,
                    [ATTR_SERVER_PORT]: isExpectedServerPort,
                    [ATTR_GEN_AI_RESPONSE_MODEL]: isExpectedResponseModel(
                      'gpt-4o-mini-2024-07-18',
                      process.env.TEST_CHAT_MODEL
                    ),
                  },
                },
              ],
            },
          },
          JSON.stringify(METRIC_GEN_AI_CLIENT_OPERATION_DURATION)
        );
        metric = findObjInArray(
          col.metrics,
          'name',
          METRIC_GEN_AI_CLIENT_TOKEN_USAGE
        );
        assertDeepMatch(
          t,
          metric,
          {
            name: METRIC_GEN_AI_CLIENT_TOKEN_USAGE,
            unit: '{token}',
            histogram: {
              dataPoints: [
                {
                  attributes: {
                    [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
                    [ATTR_GEN_AI_REQUEST_MODEL]: process.env.TEST_CHAT_MODEL,
                    [ATTR_GEN_AI_SYSTEM]: 'openai',
                    [ATTR_SERVER_ADDRESS]: isExpectedServerAddress,
                    [ATTR_SERVER_PORT]: isExpectedServerPort,
                    [ATTR_GEN_AI_RESPONSE_MODEL]: isExpectedResponseModel(
                      'gpt-4o-mini-2024-07-18',
                      process.env.TEST_CHAT_MODEL
                    ),
                    [ATTR_GEN_AI_TOKEN_TYPE]: 'input',
                  },
                },
                {
                  attributes: {
                    [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
                    [ATTR_GEN_AI_REQUEST_MODEL]: process.env.TEST_CHAT_MODEL,
                    [ATTR_GEN_AI_SYSTEM]: 'openai',
                    [ATTR_SERVER_ADDRESS]: isExpectedServerAddress,
                    [ATTR_SERVER_PORT]: isExpectedServerPort,
                    [ATTR_GEN_AI_RESPONSE_MODEL]: isExpectedResponseModel(
                      'gpt-4o-mini-2024-07-18',
                      process.env.TEST_CHAT_MODEL
                    ),
                    [ATTR_GEN_AI_TOKEN_TYPE]: 'output',
                  },
                },
              ],
            },
          },
          JSON.stringify(METRIC_GEN_AI_CLIENT_TOKEN_USAGE)
        );
      },
    },

    {
      name: 'streaming-with-tee',
      args: ['./fixtures/streaming-with-tee.js'],
      cwd: __dirname,
      env: {
        NODE_OPTIONS: '--require=./fixtures/telemetry.js',
        OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT: 'true',
        TEST_FIXTURE_RECORDING_NAME: 'streaming-with-tee',
      },
      verbose: true,
      checkTelemetry: (t, col, stdout) => {
        const spans = col.sortedSpans;

        // Only bother to assert a few fields, because we expect mostly
        // the same telemetry as with "streaming-chat-completions.js".
        assertDeepMatch(
          t,
          spans[0],
          {
            name: `chat ${process.env.TEST_CHAT_MODEL}`,
            attributes: {
              [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
            },
          },
          'spans[0]'
        );
      },
    },

    {
      // This test script aborts after receiving one token. We expect to
      // still get the GenAI span.
      name: 'streaming-abort',
      testOpts: {
        skip: usingNock
          ? 'Nock back record/replay does not work for this mid-response abort.'
          : false,
      },
      args: ['./fixtures/streaming-abort.js'],
      cwd: __dirname,
      env: {
        NODE_OPTIONS: '--require=./fixtures/telemetry.js',
        OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT: 'true',
      },
      checkTelemetry: (t, col, stdout) => {
        const spans = col.sortedSpans;

        // Only bother to assert a few fields, because we expect mostly
        // the same telemetry as with "streaming-chat-completions.js".
        assertDeepMatch(
          t,
          spans[0],
          {
            name: `chat ${process.env.TEST_CHAT_MODEL}`,
            attributes: {
              [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
              [ATTR_GEN_AI_RESPONSE_FINISH_REASONS]: undefined,
            },
          },
          'spans[0]'
        );
      },
    },

    {
      name: 'streaming-bad-iterate',
      args: ['./fixtures/streaming-bad-iterate.js'],
      cwd: __dirname,
      env: {
        NODE_OPTIONS: '--require=./fixtures/telemetry.js',
        TEST_FIXTURE_RECORDING_NAME: 'streaming-bad-iterate',
      },
      checkResult: (t, err) => {
        t.ok(err, 'got an error from iterating twice over chat stream');
        t.match(err.message, /iterate/, 'err.message includes "iterate"');
      },
    },

    {
      name: 'tool calls (captureMessageContent=true)',
      args: ['./fixtures/tools.js'],
      cwd: __dirname,
      env: {
        NODE_OPTIONS: '--require=./fixtures/telemetry.js',
        OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT: 'true',
        TEST_FIXTURE_RECORDING_NAME: 'tool-calls',
      },
      // verbose: true,
      checkTelemetry: (t, col) => {
        const spans = col.sortedSpans;

        // Match a subset of the GenAI span fields.
        assertDeepMatch(
          t,
          spans[0],
          {
            name: `chat ${process.env.TEST_CHAT_MODEL}`,
            kind: 'SPAN_KIND_CLIENT',
            attributes: {
              [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
              [ATTR_GEN_AI_REQUEST_MODEL]: process.env.TEST_CHAT_MODEL,
              [ATTR_GEN_AI_SYSTEM]: 'openai',
              [ATTR_GEN_AI_RESPONSE_FINISH_REASONS]: ['tool_calls'],
              [ATTR_GEN_AI_RESPONSE_ID]: isUnit
                ? 'chatcmpl-AfbMY0GeHGAEkO2CCeaPqeCp10Mq5'
                : /.+/,
              [ATTR_GEN_AI_RESPONSE_MODEL]: isExpectedResponseModel(
                'gpt-4o-mini-2024-07-18',
                process.env.TEST_CHAT_MODEL
              ),
              [ATTR_GEN_AI_USAGE_INPUT_TOKENS]: isUnit
                ? 140
                : isPositiveInteger,
              [ATTR_GEN_AI_USAGE_OUTPUT_TOKENS]: isUnit
                ? 19
                : isPositiveInteger,
            },
            scope: {
              name: '@elastic/opentelemetry-instrumentation-openai',
            },
          },
          'spans[0]'
        );

        assertDeepMatch(
          t,
          col.logs,
          [
            {
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_SYSTEM_MESSAGE,
              },
              body: {
                role: 'system',
                content:
                  'You are a helpful customer support assistant. Use the supplied tools to assist the user.',
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
            {
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_USER_MESSAGE,
              },
              body: {
                role: 'user',
                content: 'Hi, can you tell me the delivery date for my order?',
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
            {
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_ASSISTANT_MESSAGE,
              },
              body: {
                content:
                  'Hi there! I can help with that. Can you please provide your order ID?',
                tool_calls: null,
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
            {
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_USER_MESSAGE,
              },
              body: {
                role: 'user',
                content: 'i think it is order_12345',
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
            {
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_CHOICE,
              },
              body: {
                finish_reason: 'tool_calls',
                index: 0,
                message: {
                  tool_calls: [
                    {
                      id: isUnit ? 'call_ibw82IbShUYxvRG7J6ojeZVe' : /.+/,
                      type: 'function',
                      function: {
                        name: 'get_delivery_date',
                        arguments: isUnit
                          ? '{"order_id":"order_12345"}'
                          : /{"order_id":".*?"}/,
                      },
                    },
                  ],
                },
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
          ],
          'log events'
        );
      },
    },

    {
      name: 'streaming tool calls (captureMessageContent=true)',
      args: ['./fixtures/streaming-tools.js'],
      cwd: __dirname,
      env: {
        NODE_OPTIONS: '--require=./fixtures/telemetry.js',
        OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT: 'true',
        TEST_FIXTURE_RECORDING_NAME: 'streaming-tool-calls',
      },
      // verbose: true,
      checkTelemetry: (t, col) => {
        const spans = col.sortedSpans;

        // Match a subset of the GenAI span fields.
        assertDeepMatch(
          t,
          spans[0],
          {
            name: `chat ${process.env.TEST_CHAT_MODEL}`,
            kind: 'SPAN_KIND_CLIENT',
            attributes: {
              [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
              [ATTR_GEN_AI_REQUEST_MODEL]: process.env.TEST_CHAT_MODEL,
              [ATTR_GEN_AI_SYSTEM]: 'openai',
              [ATTR_GEN_AI_RESPONSE_FINISH_REASONS]: ['tool_calls'],
              [ATTR_GEN_AI_RESPONSE_ID]: isUnit
                ? 'chatcmpl-AfbMZdIABwae3PqzsHzvjahWPVqL6'
                : /.+/,
              [ATTR_GEN_AI_RESPONSE_MODEL]: isExpectedResponseModel(
                'gpt-4o-mini-2024-07-18',
                process.env.TEST_CHAT_MODEL
              ),
              [ATTR_GEN_AI_USAGE_INPUT_TOKENS]: isUnit
                ? 140
                : isPositiveInteger,
              [ATTR_GEN_AI_USAGE_OUTPUT_TOKENS]: isUnit
                ? 19
                : isPositiveInteger,
            },
            scope: {
              name: '@elastic/opentelemetry-instrumentation-openai',
            },
          },
          'spans[0]'
        );

        assertDeepMatch(
          t,
          col.logs,
          [
            {
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_SYSTEM_MESSAGE,
              },
              body: {
                role: 'system',
                content:
                  'You are a helpful customer support assistant. Use the supplied tools to assist the user.',
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
            {
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_USER_MESSAGE,
              },
              body: {
                role: 'user',
                content: 'Hi, can you tell me the delivery date for my order?',
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
            {
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_ASSISTANT_MESSAGE,
              },
              body: {
                content:
                  'Hi there! I can help with that. Can you please provide your order ID?',
                tool_calls: null,
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
            {
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_USER_MESSAGE,
              },
              body: {
                role: 'user',
                content: 'i think it is order_12345',
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
            {
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_CHOICE,
              },
              body: {
                finish_reason: 'tool_calls',
                index: 0,
                message: {
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: isUnit ? 'call_ltrRGOHzmLMWSIRAZImscFEy' : /.+/,
                      type: 'function',
                      function: {
                        name: 'get_delivery_date',
                        arguments: isUnit
                          ? '{"order_id":"order_12345"}'
                          : /{"order_id":".*?"}/,
                      },
                    },
                  ],
                },
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
          ],
          'log events'
        );
      },
    },

    {
      name: 'streaming parallel tool calls (captureMessageContent=true)',
      testOpts: {
        skip:
          targetService === 'ollama'
            ? 'The test model used with Ollama does not typically result in tool calls with this test.'
            : false,
      },
      args: ['./fixtures/streaming-parallel-tool-calls.js'],
      cwd: __dirname,
      env: {
        NODE_OPTIONS: '--require=./fixtures/telemetry.js',
        OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT: 'true',
        TEST_FIXTURE_RECORDING_NAME: 'streaming-parallel-tool-calls',
      },
      // verbose: true,
      checkTelemetry: (t, col) => {
        const spans = col.sortedSpans;

        // Match a subset of the GenAI span fields.
        assertDeepMatch(
          t,
          spans[0],
          {
            name: `chat ${process.env.TEST_CHAT_MODEL}`,
            kind: 'SPAN_KIND_CLIENT',
            attributes: {
              [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
              [ATTR_GEN_AI_REQUEST_MODEL]: process.env.TEST_CHAT_MODEL,
              [ATTR_GEN_AI_SYSTEM]: 'openai',
              [ATTR_GEN_AI_RESPONSE_FINISH_REASONS]: ['tool_calls'],
              [ATTR_GEN_AI_RESPONSE_ID]: isUnit
                ? 'chatcmpl-AfbMawxsp83RQ9QuzFdwpTdBbCEQu'
                : /.+/,
              [ATTR_GEN_AI_RESPONSE_MODEL]: isExpectedResponseModel(
                'gpt-4o-mini-2024-07-18',
                process.env.TEST_CHAT_MODEL
              ),
              [ATTR_GEN_AI_USAGE_INPUT_TOKENS]: isUnit ? 56 : isPositiveInteger,
              [ATTR_GEN_AI_USAGE_OUTPUT_TOKENS]: isUnit
                ? 45
                : isPositiveInteger,
            },
            events: undefined,
            scope: {
              name: '@elastic/opentelemetry-instrumentation-openai',
            },
          },
          'spans[0]'
        );

        assertDeepMatch(
          t,
          col.logs,
          [
            {
              body: {
                role: 'system',
                content:
                  'You are a helpful assistant providing weather updates.',
              },
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_SYSTEM_MESSAGE,
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
            {
              body: {
                role: 'user',
                content: 'What is the weather in New York and London?',
              },
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_USER_MESSAGE,
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
            {
              body: {
                finish_reason: 'tool_calls',
                index: 0,
                message: {
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: isUnit ? 'call_c70DUNhsnSAQ0y6d8OkyHQeg' : /.+/,
                      type: 'function',
                      function: {
                        name: 'get_weather',
                        arguments: isUnit
                          ? '{"location": "New York"}'
                          : /{"location":.*?}/,
                      },
                    },
                    {
                      id: isUnit ? 'call_5XlUHHFmQpDB0GUeNHNsNYYa' : /.+/,
                      type: 'function',
                      function: {
                        name: 'get_weather',
                        arguments: isUnit
                          ? '{"location": "London"}'
                          : /{"location":.*?}/,
                      },
                    },
                  ],
                },
              },
              attributes: {
                [ATTR_GEN_AI_SYSTEM]: 'openai',
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_CHOICE,
              },
              traceId: spans[0].traceId,
              spanId: spans[0].spanId,
            },
          ],
          'log events'
        );
      },
    },

    {
      // Ensure that Opt-In telemetry is *not* captured with
      // captureMessageContent=false (the default).
      name: 'streaming parallel tool calls (captureMessageContent=false)',
      testOpts: {
        skip:
          targetService === 'ollama'
            ? 'The test model used with Ollama does not typically result in tool calls with this test.'
            : false,
      },
      args: ['./fixtures/streaming-parallel-tool-calls.js'],
      cwd: __dirname,
      env: {
        NODE_OPTIONS: '--require=./fixtures/telemetry.js',
        TEST_FIXTURE_RECORDING_NAME: 'streaming-parallel-tool-calls',
      },
      checkTelemetry: (t, col) => {
        assertDeepMatch(
          t,
          col.logs,
          [
            // Expect there to *not* be a gen_ai.system.message event.
            // Expect there to *not* be a gen_ai.user.message event.
            {
              attributes: {
                'event.name': EVENT_GEN_AI_CHOICE,
              },
              body: {
                finish_reason: 'tool_calls',
                index: 0,
                message: {
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: isUnit ? 'call_c70DUNhsnSAQ0y6d8OkyHQeg' : /.+/,
                      type: 'function',
                      function: {
                        name: 'get_weather',
                        arguments: undefined, // This must not be captured.
                      },
                    },
                    {
                      id: isUnit ? 'call_5XlUHHFmQpDB0GUeNHNsNYYa' : /.+/,
                      type: 'function',
                      function: {
                        name: 'get_weather',
                        arguments: undefined, // This must not be captured.
                      },
                    },
                  ],
                },
              },
            },
          ],
          'log events'
        );
      },
    },

    {
      name: 'embeddings',
      args: ['./fixtures/embeddings.js'],
      cwd: __dirname,
      env: {
        NODE_OPTIONS: '--require=./fixtures/telemetry.js',
        TEST_FIXTURE_RECORDING_NAME: 'embeddings',
      },
      checkTelemetry: (t, col, _stdout) => {
        const spans = col.sortedSpans;

        // Match a subset of the GenAI span fields.
        const commonExpectedAttrs = {
          [ATTR_GEN_AI_OPERATION_NAME]: 'embeddings',
          [ATTR_GEN_AI_REQUEST_MODEL]: process.env.TEST_EMBEDDINGS_MODEL,
          [ATTR_GEN_AI_SYSTEM]: 'openai',
          [ATTR_SERVER_ADDRESS]: isExpectedServerAddress,
          [ATTR_SERVER_PORT]: isExpectedServerPort,
          [ATTR_GEN_AI_RESPONSE_MODEL]: isExpectedResponseModel(
            'text-embedding-3-small',
            process.env.TEST_EMBEDDINGS_MODEL
          ),
        };
        assertDeepMatch(
          t,
          spans[0],
          {
            name: `embeddings ${process.env.TEST_EMBEDDINGS_MODEL}`,
            kind: 'SPAN_KIND_CLIENT',
            attributes: {
              ...commonExpectedAttrs,
              [ATTR_GEN_AI_REQUEST_ENCODING_FORMATS]: ['float'],
              [ATTR_GEN_AI_USAGE_INPUT_TOKENS]: isUnit ? 8 : isPositiveInteger,
              // output_tokens is not expected in Embeddings response:
              // https://github.com/openai/openai-openapi/blob/1.3.0/openapi.yaml#L3413-L3422
              [ATTR_GEN_AI_USAGE_OUTPUT_TOKENS]: undefined,
            },
            events: undefined,
            scope: {
              name: '@elastic/opentelemetry-instrumentation-openai',
            },
          },
          'spans[0]'
        );

        if (!usingNock) {
          t.equal(spans[1].scope.name, '@opentelemetry/instrumentation-http');
          t.equal(
            spans[1].parentSpanId,
            spans[0].spanId,
            'HTTP span is a child of the GenAI span'
          );
          t.ok(
            spans[1].attributes['http.target'].includes('/embeddings'),
            'looks like a .../embeddings HTTP endpoint'
          );
        }

        // Metrics
        let metric = findObjInArray(
          col.metrics,
          'name',
          METRIC_GEN_AI_CLIENT_OPERATION_DURATION
        );
        assertDeepMatch(
          t,
          metric,
          {
            name: METRIC_GEN_AI_CLIENT_OPERATION_DURATION,
            unit: 's',
            histogram: {
              dataPoints: [
                {
                  attributes: commonExpectedAttrs,
                },
              ],
            },
          },
          JSON.stringify(METRIC_GEN_AI_CLIENT_OPERATION_DURATION)
        );
        metric = findObjInArray(
          col.metrics,
          'name',
          METRIC_GEN_AI_CLIENT_TOKEN_USAGE
        );
        assertDeepMatch(
          t,
          metric,
          {
            name: METRIC_GEN_AI_CLIENT_TOKEN_USAGE,
            unit: '{token}',
            histogram: {
              dataPoints: [
                {
                  attributes: {
                    ...commonExpectedAttrs,
                    [ATTR_GEN_AI_TOKEN_TYPE]: 'input',
                  },
                },
              ],
            },
          },
          JSON.stringify(METRIC_GEN_AI_CLIENT_TOKEN_USAGE)
        );
      },
    },

    // TODO: see Python's test_all_the_client_options, do something similar
    // TODO: test with a tool response from user after a tool call (to test https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-events.md#tool-event)
    // TODO: test a case where stream fails before completion: https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-events.md#choice-event says SHOULD have an event with truncated content and finish_reason=error
  ];

  // For-development envvar to filter down which test cases are run.
  if (process.env.TEST_FIXTURES_FILTER) {
    const filter = new RegExp(process.env.TEST_FIXTURES_FILTER);
    testFixtures = testFixtures.filter(tf => filter.test(tf.name));
  }

  if (testMode === 'regenerate-recordings') {
    const recordingNames = new Set();
    testFixtures = testFixtures
      .filter(tf => {
        if (!tf.env.TEST_FIXTURE_RECORDING_NAME) {
          return false;
        } else if (recordingNames.has(tf.env.TEST_FIXTURE_RECORDING_NAME)) {
          // Multiple test fixtures can share the same recording.
          // No need to record it twice.
          return false;
        } else {
          recordingNames.add(tf.env.TEST_FIXTURE_RECORDING_NAME);
          return true;
        }
      })
      .map(tf => {
        // Run the fixtures *without* instrumentation, and skip
        // assertions. We want as pristine a run as possible for
        // creating recordings.
        delete tf.env.NODE_OPTIONS;
        delete tf.checkTelemetry;
        return tf;
      });
  }

  runTestFixtures(suite, testFixtures);
  suite.end();
});
