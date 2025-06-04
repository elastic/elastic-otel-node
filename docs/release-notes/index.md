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

Review the changes, fixes, and more in each version of Elastic Distribution of OpenTelemetry Node.js.

To check for security updates, go to [Security announcements for the Elastic stack](https://discuss.elastic.co/c/announcements/security-announcements/31).

% Release notes include only features, enhancements, and fixes. Add breaking changes, deprecations, and known issues to the applicable release notes sections.

% ## version.next [kibana-X.X.X-release-notes]

% ### Features and enhancements [kibana-X.X.X-features-enhancements]
% *

% ### Fixes [kibana-X.X.X-fixes]
% *

## 1.0.0

### Features and enhancements

- Default to stable semantic conventions for HTTP instrumentation. [#669](https://github.com/elastic/elastic-otel-node/pull/669).
- Upgraded upstream OTel dependencies to SDK 2.0. This should be non-breaking
  for users of `node --import @elastic/opentelemetry-node my-app.js` to start
  EDOT Node.js for their application. [#663](https://github.com/elastic/elastic-otel-node/pull/663).
- Use `peerDependencies` for `@opentelemetry/api` dependency, and cap it to a  known-supported maximum version, according to [OTel JS guidance for implementors](https://github.com/open-telemetry/opentelemetry-js/issues/4832). [#606](https://github.com/elastic/elastic-otel-node/issues/606).

## 0.7.0

### Features and enhancements

- Improved ES module (ESM) instrumentation. [#584](https://github.com/elastic/elastic-otel-node/pull/584). As part of this change, using `--require @elastic/opentelemetry-node` will no longer set up a module hook for instrumenting ES modules; only using `--import @elastic/opentelemetry-node` will do so. Use `--import @elastic/opentelemetry-node` to start EDOT Node.js. Using `--require ...` is still valid when you know your application is only using CommonJS modules.
- Added `@opentelemetry/instrumentation-mysql` to the default set of instrumentations.
- Added `@opentelemetry/instrumentation-mysql2` to the default set of instrumentations.
- Added `@opentelemetry/instrumentation-cassandra-driver` to the default set of instrumentations.
- Test that the native instrumentation in `@elastic/elasticsearch@8.15.0` and later works.

## 0.6.0

### Features and enhancements

- Added `@elastic/opentelemetry-instrumentation-openai` to the default set of instrumentations.

## 0.5.0

### Features and enhancements

- Bumped `@opentelemetry/*` dependencies.

## 0.4.1

### Fixes

- Fixed release workflow. v0.4.0 was released without a GitHub releases
  entry.

## 0.4.0

### Features and enhancements

- A Docker image is now being published that can be used with the OpenTelemetry Operator's support for [auto-instrumentation injection](https://github.com/open-telemetry/opentelemetry-operator/#opentelemetry-auto-instrumentation-injection) ([#374](https://github.com/elastic/elastic-otel-node/pull/374)):

    - `docker.elastic.co/observability/elastic-otel-node:${version}` and `:latest`
      will be published for tagged releases
    - `docker.elastic.co/observability/elastic-otel-node:edge` will be published
      for each push to "main".

## 0.3.0

### Features and enhancements

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

## 0.2.0

### Features and enhancements

- Added the following `@opentelemetry/instrumentation-*` instrumentations: `hapi`, `aws-sdk`, `redis-4`, `grpc`, `pino`.
- Added cloud and container resource detectors, the same set included in `@opentelemetry/auto-instrumentations-node`. These are enabled by default. Use `OTEL_NODE_RESOURCE_DETECTORS` to set an explicit list of detectors.
- Added missing exporters for logs and metrics signals. This means that `OTEL_EXPORTER_OTLP_PROTOCOL=grpc` and `OTEL_EXPORTER_OTLP_PROTOCOL=http/json` now work. Before this change only the default `http/proto` OTLP export protocol would work by default.

## 0.1.3

### Fixes

- Correct another issue with "repository.url" setting in package.json, required for npm provenance generation.

## 0.1.2

### Fixes

Correct "repository.url" setting in package.json, required for npm provenance generation.

## 0.1.1

### Fixes

- Trimmed files included in published npm package.

## 0.1.0

First release of the Elastic Distribution of OpenTelemetry Node.js.