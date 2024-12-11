# @elastic/opentelemetry-instrumentation-openai Changelog

## v0.2.0

- Instrumentation of chat completion, including streaming and tool calls.
- Instrumentation for [`openai.embeddings.create()`](https://platform.openai.com/docs/api-reference/embeddings/create).
- Unit tests that test against recorded responses from api.openai.com.
- Integration tests that run against Ollama, OpenAI, and Azure OpenAI.
