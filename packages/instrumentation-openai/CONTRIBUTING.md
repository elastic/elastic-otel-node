# Contributing to @elastic/opentelemetry-instrumentation-openai

Thank you for contributing to this project.
Please start by reading the [CONTRIBUTING.md at the root of this repo](../../CONTRIBUTING.md).
It includes general contribution/development information relevant to all packages in this repo.


# Testing

tl;dr: This runs the unit tests:

```bash
npm ci
npm run compile

npm test
```

See [TESTING.md](./TESTING.md) for more details, including integration testing,
testing against multiple versions of the OpenAI client, etc.


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
TEST_CHAT_MODEL=gpt-4o-mini \
    node --env-file ../../openai.env -r ./telemetry.js chat-completion.js
```

