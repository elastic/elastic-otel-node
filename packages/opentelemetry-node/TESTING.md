# Testing @elastic/opentelemetry-node

tl;dr:

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
tests are [labeled with "flakey-test"](https://github.com/elastic/elastic-otel-node/labels/flaky-test).

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

XXX testing just one file, with/out services


## Requirements for writing test files

**All test files MUST match the `test/**/*.test.js` glob pattern.**

**A test file MUST be runnable independently.** I.e. one can execute
`node test/foo.test.js` independent of other test files.

**A test file MUST exit with non-zero status to indicate failure.**

**A test file SHOULD generate TAP output.**

For test files that require a running test service:

- **They MUST use an envvar to indicate whether to run and MUST skip testing if that envvar is not defined.**
  That envvar name **SHOULD** match `${NAME_OF_SERVICE}_*`, e.g. `REDIS_HOST`,
  and **the skip message MUST include "SKIP" and the envvar name.**
  For example, running [the ioredis test](./test/instr-ioredis.test.js)
  includes this output:

    ```
    $ node test/instr-ioredis.test.js
    # SKIP ioredis tests: REDIS_HOST is not set (try with `REDIS_HOST=localhost`)
    ...
    ```

- **They SHOULD fail quickly if the requisite test service is not up.**
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
- Set that envvar in the "test" script in "package.json", so that it is
  defined when `npm test` is run.
- Add the service to "test/docker-compose.yaml" and be sure to include a
  `healthcheck` section.
- Add the service and the envvar to the "test-vers" job in "../../.github/workflows/test.yml". E.g.:

    ```yaml
    env:
      REDIS_HOST: 'localhost'

    services:
      redis:
        image: redis:7
        ports:
          - 6379:6379
    ```

XXX Is 'env' needed in the YAML if 'npm test' sets those envvars?

Dev Notes:
- TODO: When we have a few services, it will be burdensome to have these envvars
  all set in the "test" script in package.json. As well, the current usage does
  not support Windows. Perhaps we could use Node v20's `--env-file` support
  for this? Or a script/.cmd wrapper that does that until v20 is the base.


XXX
```
npm test
    # Sets fallback ${SERVICE}_HOST envvar if not already set. This should
    # work in CI as well, which should be setting all those envvars.
    # This then fails if services are missing. Fail fast.

npm run test-services:start
npm test
npm run test-services:stop
    # This should pass.

npm run test:with-test-services   # oneliner for the above

# To test just stuff using one service.
npm run test-services:start redis
# npm test [FILTER]  ???
npm test redis  # or 'npm test "*redis*"' ???
node test/instr-ioredis.test.js
npm run test-services:stop redis
    # This should pass.

npm run test:without-test-services
    # Does *not* set _HOST envvars, so we expect each of those service-using
    # tests to quick skip at the top.
```
XXX

