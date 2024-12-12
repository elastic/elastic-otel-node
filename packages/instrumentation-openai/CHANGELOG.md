# @elastic/opentelemetry-instrumentation-openai Changelog

## v0.2.0

- Based on GenAI semantic conventions 1.29.
- Instrumentation of chat completion, including streaming and tool calls.
- Instrumentation of [embeddings creation](https://platform.openai.com/docs/api-reference/embeddings/create).
- Unit tests that test against recorded responses from api.openai.com.
- Integration tests that run against Ollama, OpenAI, and Azure OpenAI.
