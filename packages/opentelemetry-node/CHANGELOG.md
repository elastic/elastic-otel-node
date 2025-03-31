# @elastic/opentelemetry-node Changelog

## Unreleased

- feat: Set default value of `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE` to delta.
  This change is done to follow the recommendations specified in the [EDOT docs](https://github.com/elastic/opentelemetry/pull/63).
  (https://github.com/elastic/elastic-otel-node/pull/670)

- feat: Default to stable semantic conventions for HTTP instrumentation.
  (https://github.com/elastic/elastic-otel-node/pull/669)

- Upgrade upstream OTel dependencies to SDK 2.0. This should be non-breaking
  for users of `node --import @elastic/opentelemetry-node my-app.js` to start
  EDOT Node.js for their application.
  (https://github.com/elastic/elastic-otel-node/pull/663)

- chore: Use `peerDependencies` for `@opentelemetry/api` dep, and cap it to a
  known-supported maximum version, according to [OTel JS guidance for
  implementors](https://github.com/open-telemetry/opentelemetry-js/issues/4832)
  (https://github.com/elastic/elastic-otel-node/issues/606)

## v0.7.0

- BREAKING CHANGE: Bump min-supported node to `^18.19.0 || >=20.6.0`.
  This raises the minimum-supported Node.js to the same as coming releases of OpenTelemetry JS.
  This base version range ensures that `module.register()` is available for improved ES module
  (ESM) auto-instrumentation.
  This drops support for Node.js 14 and 16.
  (https://github.com/elastic/elastic-otel-node/pull/584)

- feat: Improve ES module (ESM) instrumentation.
  (https://github.com/elastic/elastic-otel-node/pull/584)

  As part of this change, using `--require @elastic/opentelemetry-node` will
  *no longer* setup a module hook for instrumenting ES modules; only using
  `--import @elastic/opentelemetry-node` will do so. **The recommendation now
  is to use `--import @elastic/opentelemetry-node` to start EDOT Node.js.**
  Using `--require ...` is still fine when you know your application is only
  using CommonJS modules.

  Implementation details: The underlying module hook mechanism for ESM has been
  changed to only hook modules that will potentially be patched by configured
  instrumentations.  This allows some instrumentations to work that could not
  before due to some ESM files not being hookable (at least via the imperfect
  mechanism for hooking ES modules). One such example is
  `@elastic/instrumentation-openai`.  See
  <https://github.com/nodejs/import-in-the-middle/pull/146> for internal
  details.

- feat: Add `@opentelemetry/instrumentation-mysql` to the default set
  of instrumentations. See <https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/plugins/node/opentelemetry-instrumentation-mysql#readme>

- feat: Add `@opentelemetry/instrumentation-mysql2` to the default set
  of instrumentations. See <https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/plugins/node/opentelemetry-instrumentation-mysql2#readme>

- feat: Add `@opentelemetry/instrumentation-cassandra-driver` to the default set
  of instrumentations. See <https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/plugins/node/opentelemetry-instrumentation-cassandra#readme>

- test: Test that the native instrumentation in `@elastic/elasticsearch@8.15.0` and later works.


## v0.6.0

- feat: Add `@elastic/opentelemetry-instrumentation-openai` to the default set
  of instrumentations. See <https://github.com/elastic/elastic-otel-node/tree/main/packages/instrumentation-openai#readme>

## v0.5.0

- chore: Bump `@opentelemetry/*` dependencies (#419, #411, #403)

## v0.4.1

- chore: Fix release workflow. v0.4.0 was released without a GitHub releases
  entry.

## v0.4.0

- feat: A Docker image is now being published that can be used with the
  OpenTelemetry Operator's support for [auto-instrumentation injection](https://github.com/open-telemetry/opentelemetry-operator/#opentelemetry-auto-instrumentation-injection). (https://github.com/elastic/elastic-otel-node/pull/374)

    - `docker.elastic.co/observability/elastic-otel-node:${version}` and `:latest`
      will be published for tagged releases
    - `docker.elastic.co/observability/elastic-otel-node:edge` will be published
      for each push to "main".

  Documentation to follow, but for now see [these dev notes](https://github.com/elastic/elastic-otel-node/blob/main/DEVELOPMENT.md#testing-k8s-auto-instrumentation-with-otel-operator) that walk through using the OpenTelemetry Operator with a small Node.js application.


## v0.3.0

- Bump minimum supported Node.js version to v14.18.0.
  (Previously it was v14.17.0.)

- feat: Add the following instrumentations:
    ```
    @opentelemetry/instrumentation-connect
    @opentelemetry/instrumentation-cucumber
    @opentelemetry/instrumentation-dataloader
    @opentelemetry/instrumentation-dns
    @opentelemetry/instrumentation-generic-pool
    @opentelemetry/instrumentation-knex
    @opentelemetry/instrumentation-koa
    @opentelemetry/instrumentation-lru-memoizer
    @opentelemetry/instrumentation-memcached
    @opentelemetry/instrumentation-nestjs-core
    @opentelemetry/instrumentation-net
    @opentelemetry/instrumentation-redis
    @opentelemetry/instrumentation-restify
    @opentelemetry/instrumentation-router
    @opentelemetry/instrumentation-socket.io
    ```

## v0.2.0

- feat: Add the following `@opentelemetry/instrumentation-*` instrumentations:
  `hapi`, `aws-sdk`, `redis-4`, `grpc`, `pino`.
- feat: Add cloud/container resource detectors -- the same set included in
  `@opentelemetry/auto-instrumentations-node`. These are enabled by default.
  Use `OTEL_NODE_RESOURCE_DETECTORS` to set an explicit list of detectors.
  (#214)
- feat: Add missing exporters for logs and metrics signals. This means that
  `OTEL_EXPORTER_OTLP_PROTOCOL=grpc` and `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`
  now work. Before this change only the default `http/proto` OTLP export
  protocol would work out of the box.

## v0.1.3

- chore: Correct another issue with "repository.url" setting in package.json,
  required for npm provenance generation.

## v0.1.2

- chore: Correct "repository.url" setting in package.json, required for npm
  provenance generation.

## v0.1.1

- chore: Trim files included in published npm package.

## v0.1.0

The first release of the Elastic Distribution of OpenTelemetry Node.js.
See [the README](https://github.com/elastic/elastic-otel-node/tree/main/packages/opentelemetry-node#readme).
