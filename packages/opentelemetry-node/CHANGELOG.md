# @elastic/opentelemetry-node Changelog

## Unreleased

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

The first release of the Elastic OpenTelemetry Node.js distribution.
See [the README](https://github.com/elastic/elastic-otel-node/tree/main/packages/opentelemetry-node#readme).
