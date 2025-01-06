# Testing this instrumentation

Before running tests, install dependencies and compile the TypeScript:

```
npm ci
npm run compile
```

Most commonly, run the unit tests with:

```
npm test
```

Run the unit tests against multiple supported versions of the `openai` package:

```
npm run test-all-versions
```

There are also integration tests:

```
# Set appropriate envvars...
npm run test:integration
```

The integration tests run against a real GenAI service: OpenAI, Azure OpenAI,
or a running Ollama. Which is used is determined by the environment variables.

1. OpenAI

    ```bash
    cp openai.env.example openai.env
    vi openai.env     # Add your OpenAI credentials.

    set -a; source ./openai.env
    npm run test:integration
    ```

2. Azure OpenAI

    ```bash
    cp azure.env.example azure.env
    vi azure.env     # Add your credentials and resource & deployment details.

    set -a; source ./azure.env
    npm run test:integration
    ```

3. Ollama

    ```bash
    # Run the Elastic light fork of Ollama with a few changes added to better
    # match OpenAI behavior for some tests. https://github.com/elastic/ollama/tree/testing
    docker run -it --rm -p 11434:11434 -v ~/.ollama:/root/.ollama ghcr.io/elastic/ollama/ollama:testing serve

    set -a; source ./ollama.env
    ollama pull $TEST_CHAT_MODEL
    ollama pull $TEST_EMBEDDINGS_MODEL

    npm run test:integration
    ```

# Troubleshooting

The integration tests automatically decide whether to use the `openai.OpenAI`
or `openai.AzureOpenAI` client class depending on whether the
`AZURE_OPENAI_API_KEY` envvar is set. If you happen to have this in your
environment, it may breaking running integration tests against non-Azure
services.

# Test notes for maintainers

Test files are `test/**/*.test.js`. They can be run separately:

```bash
node test/config.test.js
```

or all of them with the driver:

```bash
./node_modules/.bin/tape test/**/*.test.js
```

Really the only rule for a test file is that it exits non-zero to mean failure.

## Regenerating recorded responses

The unit tests include tests run against OpenAI, but with Node's http modules
mocked out (by `nock`) to return pre-recorded HTTP responses. Those are
stored in "test/fixtures/nock-recordings". When updating tests or adding new
ones, those recordings might need to be regenerated. This runs against
api.openai.com, so you must have valid OpenAI auth set in your environment.

```bash
cp openai.env.example openai.env
vi openai.env           # Add your OpenAI credentials.

set -a; source openai.env
npm run test:regenerate-recordings
```

## Filtering which fixture tests are run

The bulk of the tests are in "test/fixtures.test.js". This is one big table
test. The set of fixture tests run can be filtered via
`TEST_FIXTURES_FILTER=<regex>` to help with a quicker dev/test cycle.
For example:

```bash
TEST_FIXTURES_FILTER=embeddings npm test
TEST_FIXTURES_FILTER=stream npm run test:openai
```

## Limitations

The nock record/replay has some limitations:

- If you look at the recordings, they are *partly* readable. However the
  response looks something like this:

    ```
        "response": [
            "1f8b080000000000000...ca77f434fb3851d2fd86474",
            "525af05ed4c08bf3106...ffff03007937b48a44020000"
        ],
    ```

    This is because nock has received a response with `Content-Encoding: gzip`.
    In this case, nock does not decompress the response. The result is that the
    stored recordings are somewhat opaque. This is not a blocker, but is
    unfortunate. Fixes have been proposed (e.g.
    https://github.com/nock/nock/pull/2359 and links from that PR), but have not
    been merged into nock.

- Nock's monkey-patching of `http` breaks `@opentelemetry/instrumentation-http`,
  so when testing is using Nock (i.e. the unit tests), the test assertions
  need to *not* expect any HTTP spans.

