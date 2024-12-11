# Elastic's OpenTelemetry instrumentation for `openai`

This module, `@elastic/opentelemetry-instrumentation-openai`, provides automatic
instrumentation of [`openai`](https://www.npmjs.com/package/openai), the OpenAI
Node.js client library.

It attempts to track the [GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions/tree/main/docs/gen-ai).


# Status

Instrumented OpenAI API endpoints:
- :white_check_mark: [Chat](https://platform.openai.com/docs/api-reference/chat)
- :white_check_mark: [Embeddings](https://platform.openai.com/docs/api-reference/embeddings)


# Supported versions

- This instruments the `openai` package in the range: `>=4.19.0 <5`.
- This supports Node.js 18 and later. (`openai@4` currently only tests with Node.js v18.)


# Semantic Conventions

This instrumentation currently implements version 1.29.0 of the GenAI
semantic-conventions: https://opentelemetry.io/docs/specs/semconv/gen-ai/


# Installation

```bash
npm install @elastic/opentelemetry-instrumentation-openai
```


# Usage

This example shows the OTel setup code and app code in the same file.
Typically, the OTel setup code would be in a separate file and run via
`node -r ...`. See a more complete example at "test/fixtures/telemetry.js".

```js
const {NodeSDK, tracing, api} = require('@opentelemetry/sdk-node');
const {HttpInstrumentation} = require('@opentelemetry/instrumentation-http');
const {OpenAIInstrumentation} = require('@elastic/opentelemetry-instrumentation-openai');
const sdk = new NodeSDK({
    spanProcessor: new tracing.SimpleSpanProcessor(new tracing.ConsoleSpanExporter()),
    instrumentations: [
        // HTTP instrumentation is not required, but it can be interesting to see
        // openai and http spans in the trace.
        new HttpInstrumentation(),
        new OpenAIInstrumentation({
            // See below for OpenAI instrumentation configuration.
        })
    ]
})
sdk.start();
process.once('beforeExit', async () => { await sdk.shutdown() });

const OpenAI = require('openai');
async function main() {
    const openai = new OpenAI();
    const result = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {role: 'user', content: 'Say hello world.'}
        ]
    });
    console.log(result.choices[0]?.message?.content);
}
```


# Examples

In the "examples/" directory, [use-chat.js](./examples/use-chat.js) is a simple
script using the OpenAI Chat Completion API.  First, run the script **without
instrumentation**.

Using OpenAI:

```bash
OPENAI_API_KEY=sk-... \
    node use-chat.js
```

Using Azure OpenAI (this assumes your Azure OpenAI endpoint has a model
deployment with the name 'gpt-4o-mini'):

```bash
AZURE_OPENAI_ENDPOINT=https://YOUR-ENDPOINT-NAME.openai.azure.com \
    AZURE_OPENAI_API_KEY=... \
    OPENAI_API_VERSION=2024-05-01-preview \
    node use-chat.js
```

Using [Ollama](https://ollama.com) (a tool for running LLMs locally, it exposes
an OpenAI-compatible API):

```bash
ollama serve

# When using Ollama, we default to qwen2.5:0.5b, which is a small model. You
# can choose a larger one, or a different tool capable model like mistral-nemo.
export MODEL_CHAT=qwen2.5
ollama pull $MODEL_CHAT

OPENAI_BASE_URL=http://localhost:11434/v1 \
    node use-chat.js
```

Now, to run **with instrumentation**, you can use [examples/telemetry.js](./test/fixtures/telemetry.js)
to bootstrap the OpenTelemetry SDK using this instrumentation. Add the Node.js
`-r ./telemetry.js` option to bootstrap before the script runs. For example:

```bash
# Configure the OTel SDK as appropriate for your setup:
export OTEL_EXPORTER_OTLP_ENDPOINT=https://{your-otlp-endpoint.example.com}
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=..."
export OTEL_SERVICE_NAME=my-service

OPENAI_API_KEY=sk-... \
    node -r ./telemetry.js use-chat.js
```


# Configuration

| Option                  | Type      | Description |
|-------------------------|-----------|-------------|
| `captureMessageContent` | `boolean` | Enable capture of content data, such as prompt and completion content. Default `false` to avoid possible exposure of sensitive data. `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` environment variable overrides. |


For example:

```bash
cd examples
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true \
    OPENAI_API_KEY=sk-... \
    node -r ./telemetry.js use-chat.js
```


# Testing

Before running tests, install dependencies and compile the TypeScript:

```
npm install
npm run compile
```

Then, run the tests via:

```bash
npm test
```

By default, this tests against *pre-recorded* OpenAI responses.
See [TESTING.md](./TESTING.md) for more details, including testing with
[Ollama](https://ollama.com), testing directly against OpenAI, etc.


# ESM

OpenTelemetry instrumentation of ECMAScript Module (ESM) code -- code using
`import ...` rather than `require(...)` -- is experimental and very limited.
This section shows that it is possible to get instrumentation of `openai`
working with ESM code.

```bash
npm install
cd examples
node --import ./telemetry.mjs use-chat-esm.mjs
```

See the comments in [examples/telemetry.mjs](./examples/telemetry.mjs) for
limitations with this. The limitations are with OpenTelemetry JS, not with this
instrumentation.

(TODO: Create and point to a follow-up issue(s) for necessary OTel JS work for this support.)


# Dev Notes

Use `DEBUG=elastic-opentelemetry-instrumentation-openai` for some diagnostic
output from the instrumentation.  For example:

```bash
DEBUG=elastic-opentelemetry-instrumentation-openai npm run example

# Alternative:
node --env-file ./dev.env ...
```

The test scripts in "test/fixtures/" can be run outside of the test suite for
dev/debugging. For example:

```
npx @elastic/mockotlpserver  # or whatever OTLP endpoint you like to use

cd test/fixtures
TEST_MODEL_TOOLS=gpt-4o-mini \
    node --env-file ../../openai.env -r ./telemetry.js chat-completion.js
```

