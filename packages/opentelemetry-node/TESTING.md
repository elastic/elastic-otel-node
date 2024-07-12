# Testing @elastic/opentelemetry-node

tl;dr: To run all tests locally:

```
npm run test-services:start
npm test
npm run test-services:stop
```

This package is a [distribution](https://opentelemetry.io/docs/concepts/distributions/)
of the OpenTelemetry Node.js SDK. Generally we strive to upstream as much
functionality as possible to OpenTelemetry. That extends to testing as well.
The testing in this package intends to test (a) functionality specific to
this distribution, plus (b) minimal quick sanity testing of some functionality
that is common to OpenTelemetry (e.g. small tests of each included
instrumentation).


## Flaky tests

Ideally tests pass all the time. However, periodically there will be flaky
tests -- i.e. tests that fail occasionally and are being investigated. Those
tests are [labeled with "flaky-test"](https://github.com/elastic/elastic-otel-node/labels/flaky-test).

Ideally this list is zero most of the time. However, collecting data on flaky
tests to come up with a correct fix is often better than just skipping and
forgetting about them.


## Testing in CI

This repo uses GitHub Actions for CI.
Currently all testing is handled by the "test.yml" workflow.
Tests are run on every PR and are required to be passing before merge.

- test workflow: https://github.com/elastic/elastic-otel-node/blob/main/.github/workflows/test.yml
- "main" branch latest test runs: https://github.com/elastic/elastic-otel-node/actions/workflows/test.yml?query=branch%3Amain


## Testing locally for development

Running all tests. This requires starting some tests services (e.g. databases).

```
npm run test-services:start
npm test
npm run test-services:stop
```

Running tests, but skipping those that require test services:

```
npm run test:without-test-services
```

Running just one test file:

```
node test/instr-http.test.js
```

Running just one test file that requires a particular test service:

```
npm run test-services:start redis
REDIS_HOST=localhost node test/instr-ioredis.test.js
  # or use --env-file with Node v20 and later:
  #   node --env-file ./test/test-services.env test/instr-ioredis.test.js
npm run test-services:stop redis
```


## Requirements for writing test files

1. **All test files MUST match the `test/**/*.test.js` glob pattern.**

2. **A test file MUST be runnable independently.**<br/>
   I.e. one can execute `node test/foo.test.js` independent of other test files.

3.  **A test file MUST exit with non-zero status to indicate failure.**

4.  **A test file SHOULD generate TAP output.**

In addition, for test files that require a running test service:

5. **They MUST use an envvar to indicate whether to run and MUST skip testing if that envvar is not defined.**<br/>
    That envvar name **SHOULD** match `${NAME_OF_SERVICE}*`, e.g. `REDIS_HOST` or `PGHOST`,
    and **the skip message MUST include "SKIP" and the envvar name.**

    For example, running [the ioredis test](./test/instr-ioredis.test.js)
    includes this output:

    ```
    $ node test/instr-ioredis.test.js
    # SKIP ioredis tests: REDIS_HOST is not set (try with `REDIS_HOST=localhost`)
    ...
    ```

    The idea here is that there is an explicit signal that the test file can
    expect its required test services to be running, otherwise it skips out.
    This allows `npm run test:without-test-services` to work. It is fine if
    the test file is configurable via more than this one environment variable
    (e.g. separate `MONGODB_HOST` and `MONGODB_PORT` envvars). However it
    would be nice if all but one have reasonable default values.

6. **They SHOULD fail quickly if the requisite test service is not up.**<br/>
    For example, running the ioredis test with `REDIS_HOST` set but no running
    Redis, fails within a couple seconds:

    ```
    $ time REDIS_HOST=localhost node test/instr-ioredis.test.js
    TAP version 13
    # ioredis instrumentation
    ...
    1..1
    # tests 1
    # pass  0
    # fail  1

    REDIS_HOST=localhost node test/instr-ioredis.test.js  0.67s user 0.19s system 57% cpu 1.485 total
    ```

## Adding a test service

Some tests require a running service to test against. E.g. Redis instrumentation
use a running Redis for tests. Here are some notes on adding test services
to this testing.

- Pick an envvar name that will be used to determine if the test file runs or
  skips. E.g. `REDIS_HOST`.
- Ensure that your test file(s) skip out if that envvar is not defined.
  Running `node test/your-file.test.js` should skip out with a message
  including "SKIP" and the envvar name.
- Set that envvar in the "test/test-services.env" file, so that it is defined
  when `npm test` is run.
- Add the service to "test/docker-compose.yaml" and be sure to include a
  `healthcheck` section. (This docker compose file is used by
  `npm run test-services:*` for local dev testing.)
- Add the service to the "test-vers" job in "../../.github/workflows/test.yml"
  for testing in CI. E.g.:

    ```yaml
    services:
      redis:
        image: redis:7
        ports:
          - 6379:6379
    ```


