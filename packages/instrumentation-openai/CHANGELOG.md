# @elastic/opentelemetry-instrumentation-openai Changelog

## v0.5.1

- Update OpenTelemetry JS dependencies to latest.

## v0.5.0

- Update to [OpenTelemetry JS SDK 2.0](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/upgrade-to-2.x.md).
  - Bump minimum supported Node.js to `^18.19.0 || >=20.6.0`.

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
