---
navigation_title: Deprecations 
description: Deprecations for Elastic Distribution of OpenTelemetry Node.js.
applies_to:
  stack:
  serverless:
    observability:
products:
  - id: cloud-serverless
  - id: observability
  - id: edot-sdk
---

# Elastic Distribution of OpenTelemetry Node.js deprecations [edot-nodejs-deprecations]

Over time, certain Elastic functionality becomes outdated and is replaced or removed. To help with the transition, Elastic deprecates functionality for a period before removal, giving you time to update your applications.

Review the deprecated functionality for Elastic Distribution of OpenTelemetry Node.js. While deprecations have no immediate impact, we strongly encourage you update your implementation after you upgrade. To learn how to upgrade, check out [Upgrade](docs-content://deploy-manage/upgrade.md).

% ## Next version [edot-node-X.X.X-deprecations]

% Use the following template to add entries to this document.

% TEMPLATE START
% ::::{dropdown} Deprecation title
% Description of the deprecation.
% **Impact**<br> Impact of the deprecation.
% **Action**<br> Steps for mitigating impact.
% View [PR #](PR link).
% ::::
% TEMPLATE END

## Next version [edot-node-X.X.X-deprecations]

::::{dropdown} `ELASTIC_OTEL_HOST_METRICS_DISABLED` deprecation
The `ELASTIC_OTEL_HOST_METRICS_DISABLED` environment variable is now deprecated.
**Impact**<br> When support is removed EDOT will start sending host metrics if you still use this env var.
**Action**<br> Use `OTEL_METRICS_EXPORTER=none` to turn off any metrics exported by EDOT Node.js. Use `OTEL_NODE_DISABLED_INSTRUMENTATIONS=host-metrics` if you only want to disable host metrics while keep sending other metrics.
View [PR #1516](https://github.com/elastic/elastic-otel-node/pull/1516).
::::

## 1.1.0 [edot-node-1.1.0-deprecations]

::::{dropdown} `ELASTIC_OTEL_METRICS_DISABLED` deprecation
The `ELASTIC_OTEL_METRICS_DISABLED` environment variable is now deprecated.
**Impact**<br> When support is removed EDOT will start sending host and runtime metrics if you still use this env var.
**Action**<br> Use `OTEL_METRICS_EXPORTER=none` to turn off any metrics exported by EDOT Node.js.
View [PR #768](https://github.com/elastic/elastic-otel-node/pull/768).
::::