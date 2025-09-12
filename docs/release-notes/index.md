---
navigation_title: EDOT Node.js
description: Release notes for Elastic Distribution of OpenTelemetry Node.js.
applies_to:
  stack:
  serverless:
    observability:
products:
  - id: cloud-serverless
  - id: observability
  - id: edot-sdk
---

# Elastic Distribution of OpenTelemetry Node.js release notes [edot-nodejs-release-notes]

Review the changes, fixes, and more in each version of Elastic Distribution of OpenTelemetry Node.js (EDOT Node.js).

To check for breaking changes, see [EDOT Node.js Breaking Changes](./breaking-changes.md).

To check for security updates, go to [Security announcements for the Elastic stack](https://discuss.elastic.co/c/announcements/security-announcements/31).

% Release notes include only features, enhancements, and fixes. Add breaking changes, deprecations, and known issues to the applicable release notes sections.
%
% ## version.next [edot-node-X.X.X-release-notes]
%
% ### Features and enhancements [edot-node-X.X.X-features-enhancements]
% *
%
% ### Fixes [edot-node-X.X.X-fixes]
% *


## next [edot-node-next-release-notes]

### Features and enhancements [edot-node-next-features-enhancements]

* This Elastic-authored `@elastic/opentelemetry-instrumentation-openai`
  instrumentation has been [upstreamed to OpenTelemetry](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-openai/).
  EDOT Node.js now uses the `@opentelemetry/instrumentation-openai` package
  to instrument `openai`. The newer package supports instrumenting openai@5 --
  the current major version.
  [#1015](https://github.com/elastic/elastic-otel-node/pull/1015)

    * If you were using `@elastic/opentelemetry-instrumentation-openai` with the
      `OTEL_NODE_ENABLED_INSTRUMENTATIONS` or `OTEL_NODE_ENABLED_INSTRUMENTATIONS`
      environment variables, you should switch to using `openai`. The old value
      will still work until the next major release.

### Fixes [edot-node-next-fixes]

## 1.3.0 [edot-node-1.3.0-release-notes]

### Features and enhancements [edot-node-1.3.0-features-enhancements]

* Added `@opentelemetry/instrumentation-oracledb` to the default set of instrumentations.

* New Central Configuration settings. Typically these settings are only useful
  for temporary debugging of telemetry.

    * `send_traces`: A boolean to disable/enable sending of trace telemetry (i.e. spans).
    * `send_metrics`: The same, for the metrics signal.
    * `send_logs`: The same, for the logs signal.

  While these are supported in EDOT Node.js, they will only be present in
  "Agent Configuration" UI of Kibana version 9.2 and later.
  [#928](https://github.com/elastic/elastic-otel-node/pull/928)

* New `ELASTIC_OTEL_CONTEXT_PROPAGATION_ONLY` configuration environment variable.
  Set this to `true` to disable sending of spans, but otherwise continue to
  do context propagation. This can be useful in limited conditions to support
  propagating trace-context through a service to downstream services for
  distributed tracing, but not collect spans from the service. (Note that this
  typically results in incomplete or broken traces in Kibana trace viewer.)
  [#928](https://github.com/elastic/elastic-otel-node/pull/928)

### Fixes [edot-node-1.3.0-fixes]

### Chores [edot-node-1.3.0-chores]

* OTLP export requests (HTTP flavors only) will include an identifier for EDOT Node.js in the User-Agent header.
  [#982](https://github.com/elastic/elastic-otel-node/pull/982)

## 1.2.0 [edot-node-1.2.0]

### Features and enhancements [edot-node-1.2.0-features-enhancements]

- Initial support for Central Configuration: the ability to configure some aspects of EDOT Node.js in running instrumented applications from a central Kibana. This feature is in technical preview. [#834](https://github.com/elastic/elastic-otel-node/pull/834) [#886](https://github.com/elastic/elastic-otel-node/pull/886)

  This release includes support for the following settings: `logging_level`, `deactivate_all_instrumentations`, `deactivate_instrumentations`

### Chores [edot-node-1.2.0-chores]

- Support for instrumenting `redis` version 4 has moved from `@opentelemetry/instrumentation-redis-4` to `@opentelemetry/instrumentation-redis`. If you are using the `OTEL_NODE_ENABLED_INSTRUMENTATIONS` or `OTEL_NODE_DISABLED_INSTRUMENTATIONS` environment variables to control instrumentation of `redis@4` you will need to change from using "redis-4" to "redis".

## 1.1.1 [edot-node-1.1.1-release-notes]

### Fixes [edot-node-1.1.1-fixes]

- Fix publishing so that the "hook.mjs" file is included.
  [#835](https://github.com/elastic/elastic-otel-node/pull/835)

  Without this fix, using `node --import @elastic/opentelemetry-node ...` will
  crash with:

        Cannot find module '.../node_modules/@elastic/opentelemetry-node/hook.mjs' imported from .../node_modules/@elastic/opentelemetry-node/import.mjs


## 1.1.0 [edot-node-1.1.0-release-notes]

### Features and enhancements [edot-node-1.1.0-features-enhancements]

- Added the `ELASTIC_OTEL_HOST_METRICS_DISABLED` environment variable to control whether EDOT Node.js collects host metrics (`process.*`). This means users can turn off host metrics without affecting metrics from instrumentations. [#736](https://github.com/elastic/elastic-otel-node/pull/736)

The `ELASTIC_OTEL_METRICS_DISABLED` environment variable is now deprecated. Use `OTEL_METRICS_EXPORTER=none` to turn off any metrics exported by EDOT Node.js.

- Restored the `@elastic/opentelemetry-node/sdk` entry point. You can use `node --import ./telemetry.mjs app.js` rather than the typical zero-code
`node --import @elastic/opentelemetry-node app.js` method for starting the SDK. [#718](https://github.com/elastic/elastic-otel-node/pull/718).

The `./telemetry.mjs` file uses APIs exported by `@elastic/opentelemetry-node/sdk`
to configure and start the OpenTelemetry Node.js SDK. See `examples/telemetry.mjs`.

::::{warning}
Bootstrapping the Node SDK in code often requires using OpenTelemetry JS APIs that are not yet stable. These APIs might break in minor versions of `@elastic/opentelemetry-node`.
::::

## 1.0.0 [edot-node-1.0.0-release-notes]

### Features and enhancements [edot-node-1.0.0-features-enhancements]

- Default to stable semantic conventions for HTTP instrumentation. [#669](https://github.com/elastic/elastic-otel-node/pull/669).
- Upgraded upstream OTel dependencies to SDK 2.0. This should be non-breaking
  for users of `node --import @elastic/opentelemetry-node my-app.js` to start
  EDOT Node.js for their application. [#663](https://github.com/elastic/elastic-otel-node/pull/663).
- Use `peerDependencies` for `@opentelemetry/api` dependency, and cap it to a  known-supported maximum version, according to [OTel JS guidance for implementors](https://github.com/open-telemetry/opentelemetry-js/issues/4832). [#606](https://github.com/elastic/elastic-otel-node/issues/606).

## 0.7.0 [edot-node-0.7.0-release-notes]

### Features and enhancements [edot-node-0.7.0-features-enhancements]

- Improved ES module (ESM) instrumentation. [#584](https://github.com/elastic/elastic-otel-node/pull/584). As part of this change, using `--require @elastic/opentelemetry-node` will no longer set up a module hook for instrumenting ES modules; only using `--import @elastic/opentelemetry-node` will do so. Use `--import @elastic/opentelemetry-node` to start EDOT Node.js. Using `--require ...` is still valid when you know your application is only using CommonJS modules.
- Added `@opentelemetry/instrumentation-mysql` to the default set of instrumentations.
- Added `@opentelemetry/instrumentation-mysql2` to the default set of instrumentations.
- Added `@opentelemetry/instrumentation-cassandra-driver` to the default set of instrumentations.
- Test that the native instrumentation in `@elastic/elasticsearch@8.15.0` and later works.

## 0.6.0 [edot-node-0.6.0-release-notes]

### Features and enhancements [edot-node-0.6.0-features-enhancements]

- Added `@elastic/opentelemetry-instrumentation-openai` to the default set of instrumentations.

## 0.5.0 [edot-node-0.5.0-release-notes]

### Features and enhancements [edot-node-0.5.0-features-enhancements]

- Bumped `@opentelemetry/*` dependencies.

## 0.4.1 [edot-node-0.4.1-release-notes]

### Fixes [edot-node-0.4.1-fixes]

- Fixed release workflow. v0.4.0 was released without a GitHub releases
  entry.

## 0.4.0 [edot-node-0.4.0-release-notes]

### Features and enhancements [edot-node-0.4.0-features-enhancements]

- A Docker image is now being published that can be used with the OpenTelemetry Operator's support for [auto-instrumentation injection](https://github.com/open-telemetry/opentelemetry-operator/#opentelemetry-auto-instrumentation-injection) ([#374](https://github.com/elastic/elastic-otel-node/pull/374)):

    - `docker.elastic.co/observability/elastic-otel-node:${version}` and `:latest`
      will be published for tagged releases
    - `docker.elastic.co/observability/elastic-otel-node:edge` will be published
      for each push to "main".

## 0.3.0 [edot-node-0.3.0-release-notes]

### Features and enhancements [edot-node-0.3.0-features-enhancements]

- Added the following instrumentations:
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
- Bumped minimum supported Node.js version to v14.18.0.

## 0.2.0 [edot-node-0.2.0-release-notes]

### Features and enhancements [edot-node-0.2.0-features-enhancements]

- Added the following `@opentelemetry/instrumentation-*` instrumentations: `hapi`, `aws-sdk`, `redis-4`, `grpc`, `pino`.
- Added cloud and container resource detectors, the same set included in `@opentelemetry/auto-instrumentations-node`. These are enabled by default. Use `OTEL_NODE_RESOURCE_DETECTORS` to set an explicit list of detectors.
- Added missing exporters for logs and metrics signals. This means that `OTEL_EXPORTER_OTLP_PROTOCOL=grpc` and `OTEL_EXPORTER_OTLP_PROTOCOL=http/json` now work. Before this change only the default `http/proto` OTLP export protocol would work by default.

## 0.1.3 [edot-node-0.1.3-release-notes]

### Fixes [edot-node-0.1.3-fixes]

- Correct another issue with "repository.url" setting in package.json, required for npm provenance generation.

## 0.1.2 [edot-node-0.1.2-release-notes]

### Fixes [edot-node-0.1.2-fixes]

Correct "repository.url" setting in package.json, required for npm provenance generation.

## 0.1.1 [edot-node-0.1.1-release-notes]

### Fixes [edot-node-0.1.1-fixes]

- Trimmed files included in published npm package.

## 0.1.0 [edot-node-0.1.0-release-notes]

First release of the Elastic Distribution of OpenTelemetry Node.js.
