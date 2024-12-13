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

First install the packages used in the example:

```bash
npm install openai \
  @opentelemetry/sdk-node \
  @elastic/opentelemetry-instrumentation-openai
```

Save this to a file, say "example.js". (This example shows the OTel setup code
and app code in the same file. Typically, the OTel setup code would be in a
separate file and run via `node -r ...`. See [a more complete OTel setup
example here](./test/fixtures/telemetry.js).)

```js
const {NodeSDK} = require('@opentelemetry/sdk-node');
const {OpenAIInstrumentation} = require('@elastic/opentelemetry-instrumentation-openai');
const sdk = new NodeSDK({
    instrumentations: [
        new OpenAIInstrumentation({
            // See the "Configuration" section below.
            captureMessageContent: true,
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
main();
```

Then run it:

```bash
OPENAI_API_KEY=sk-... \
    node example.js
```

By default, the `NodeSDK` will export telemetry via OTLP. As a first example
to see the telemetry on the console use:

```bash
OTEL_TRACES_EXPORTER=console \
    OTEL_LOGS_EXPORTER=console \
    OTEL_METRICS_EXPORTER=console \
    OPENAI_API_KEY=sk-... \
    node example.js
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
    OPENAI_API_VERSION=2024-10-01-preview \
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


# ESM

OpenTelemetry instrumentation of ECMAScript Module (ESM) code -- code using
`import ...` rather than `require(...)` -- is experimental and very limited.
This section shows that it is possible to get instrumentation of `openai`
working with ESM code.

```bash
npm install
npm run compile
cd examples
node --import ./telemetry.mjs use-chat-esm.mjs
```

See the comments in [examples/telemetry.mjs](./examples/telemetry.mjs) for
limitations with this. The limitations are with OpenTelemetry JS, not with this
instrumentation.

(TODO: Create and point to a follow-up issue(s) for necessary OTel JS work for this support.)

