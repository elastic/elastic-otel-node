# @elastic/opentelemetry-instrumentation-openai Changelog

## Unreleased

- Instrumentation of chat completion, including streaming and tool calls.
- Initial instrumentation for [`openai.embeddings.create()`](https://platform.openai.com/docs/api-reference/embeddings/create),
  using semantic conventions per [semconv #1603](https://github.com/open-telemetry/semantic-conventions/pull/1603).
- Unit tests that test against recorded responses from api.openai.com.
- Integration tests that run against Ollama, OpenAI, and Azure OpenAI.
