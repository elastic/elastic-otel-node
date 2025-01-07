# OpenAI Zero-Code Instrumentation Examples

This is an example of how to instrument OpenAI calls with zero code changes,
using `@elastic/opentelemetry-node` included in the Elastic Distribution of
OpenTelemetry Node.js ([EDOT Node.js][edot-node]).

When OpenAI examples run, they export traces, metrics and logs to an OTLP
compatible endpoint. Traces and metrics include details such as the model used
and the duration of the LLM request. In the case of chat, Logs capture the
request and the generated response. The combination of these provide a
comprehensive view of the performance and behavior of your OpenAI usage.

## Install

First, set up a Node.js environment for the examples like this:
```bash
nvm use --lts
npm install
```

## Configure

Copy [env.example](env.example) to `.env` and update its `OPENAI_API_KEY`.

An OTLP compatible endpoint should be listening for traces, metrics and logs on
`http://localhost:4317`. If not, update `OTEL_EXPORTER_OTLP_ENDPOINT` as well.

For example, if Elastic APM server is running locally, edit `.env` like this:
```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:8200
```

## Run

There are two examples, and they run the same way:

### Chat

[chat.js](chat.js) asks the LLM a geography question and prints the response.

Run it like this:
```bash
node --env-file .env --require @elastic/opentelemetry-node chat.js
```

You should see something like "Atlantic Ocean" unless your LLM hallucinates!

### Embeddings


[embeddings.js](embeddings.js) creates in-memory VectorDB embeddings about
Elastic products. Then, it searches for one similar to a question.

Run it like this:
```bash
node --env-file .env --require @elastic/opentelemetry-node embeddings.js
```

You should see something like "Connectors can help you connect to a database",
unless your LLM hallucinates!

---

[edot-node]: https://github.com/elastic/elastic-otel-node/blob/main/packages/opentelemetry-node/README.md#install
