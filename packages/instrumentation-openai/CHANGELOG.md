# @elastic/opentelemetry-instrumentation-openai Changelog

## Unreleased

- Support instrumenting openai@5, including preleases. Currently only 5.0.0-alpha.0
  has been released.

## v0.4.1

- Include "LICENSE" file in the published package.

## v0.4.0

- Fix the release workflow.

## v0.3.0

(Broken release. Use v0.4.0 or later.)

- Based on GenAI semantic conventions 1.29.
- Instrumentation of chat completion, including streaming and tool calls.
- Instrumentation of [embeddings creation](https://platform.openai.com/docs/api-reference/embeddings/create).
- Unit tests that test against recorded responses from api.openai.com.
- Integration tests that run against Ollama, OpenAI, and Azure OpenAI.
