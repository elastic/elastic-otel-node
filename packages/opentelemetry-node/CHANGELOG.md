# @elastic/opentelemetry-node Changelog

## Unreleased

- feat: Add `@opentelemetry/instrumentation-mysql` to the default set
  of instrumentations. See <https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/plugins/node/opentelemetry-instrumentation-mysql#readme>
- feat: Add `@opentelemetry/instrumentation-mysql2` to the default set
  of instrumentations. See <https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/plugins/node/opentelemetry-instrumentation-mysql2#readme>
- feat: Add `@opentelemetry/instrumentation-cassandra-driver` to the default set
  of instrumentations. See <https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/plugins/node/opentelemetry-instrumentation-cassandra#readme>
- chore: Test that the native instrumentation in `@elastic/elasticsearch@8.15.0` and later works.


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
