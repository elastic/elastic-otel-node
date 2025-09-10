---
navigation_title: Breaking changes
description: Breaking changes for Elastic Distribution of OpenTelemetry Node.js.
applies_to:
  stack:
  serverless:
    observability:
products:
  - id: cloud-serverless
  - id: observability
  - id: edot-sdk
---

# Elastic Distribution of OpenTelemetry Node.js breaking changes [edot-nodejs-breaking-changes]

Breaking changes can impact your Elastic applications, potentially disrupting normal operations. Before you upgrade, carefully review the Elastic Distribution of OpenTelemetry  breaking changes and take the necessary steps to mitigate any issues.

% ## Next version [edot-node-X.X.X-breaking-changes]

% Use the following template to add entries to this document.

% TEMPLATE START
% $$$kibana-PR_NUMBER$$$
% ::::{dropdown} Title of breaking change
% Description of the breaking change.
% **Impact**<br> Impact of the breaking change.
% **Action**<br> Steps for mitigating impact.
% Refer to [PR #](PR link).
% ::::
% TEMPLATE END

% 1. Copy and edit the template in the right area section of this file. Most recent entries should be at the top of the section.
% 2. Edit the anchor ID ($$$kibana-PR_NUMBER$$$) of the template with the correct PR number to give the entry a unique URL.
% 3. Don't hardcode the link to the new entry. Instead, make it available through the doc link service files:
%   - {kib-repo}blob/{branch}/src/platform/packages/shared/kbn-doc-links/src/get_doc_links.ts
%   - {kib-repo}blob/{branch}/src/platform/packages/shared/kbn-doc-links/src/types.ts
%
% The entry in the main links file should look like this:
%
% id: `${KIBANA_DOCS}breaking-changes.html#kibana-PR_NUMBER`
%
% 4. You can then call the link from any Kibana code. For example: `href: docLinks.links.upgradeAssistant.id`
% Check https://docs.elastic.dev/docs/kibana-doc-links (internal) for more details about the Doc links service.

## 1.2.0 [edot-node-1.2.0-breaking-changes]

::::{dropdown} Change usage of "redis-4" to "redis" in `OTEL_NODE_ENABLED_INSTRUMENTATIONS` and `OTEL_NODE_DISABLED_INSTRUMENTATIONS`

Support for instrumenting `redis` version 4 has moved from `@opentelemetry/instrumentation-redis-4` to `@opentelemetry/instrumentation-redis`. If you are using the `OTEL_NODE_ENABLED_INSTRUMENTATIONS` or `OTEL_NODE_DISABLED_INSTRUMENTATIONS` environment variables to control instrumentation of `redis@4` you will need to change from using "redis-4" to "redis".
::::

## 1.1.0

::::{dropdown} AWS SDK v2 instrumentation has been dropped

Refer to the [opentelemetry-instrumentation-aws-sdk release notes](https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/plugins/node/opentelemetry-instrumentation-aws-sdk/CHANGELOG.md#0510-2025-04-08). The `aws.region` span attribute has been changed to `cloud.region`.

Refer to [Issue #814](https://github.com/elastic/elastic-otel-node/pull/814) and [Issue #788](https://github.com/elastic/elastic-otel-node/pull/788).
::::

## 1.0.0

::::{dropdown} Changed the default behavior of logging framework instrumentations

**Impact**<br> Logging framework instrumentations for Bunyan, Pino, and Winston no longer do log sending by default. The new default behavior effectively sets the default config for these instrumentations to `{disableLogSending: true}`.

**Action**<br> To enable log-sending by default, set `ELASTIC_OTEL_ENABLE_LOG_SENDING=true`.

Refer to [Issue #680](https://github.com/elastic/elastic-otel-node/issues/680).
::::

::::{dropdown} Set default value of metrics temporality preference to delta

**Impact**<br> The default value of `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE` is now set to `delta`.

**Action**<br> If you require the previous behavior, explicitly set the environment variable to your preferred value.

Refer to [PR #670](https://github.com/elastic/elastic-otel-node/pull/670).
::::

::::{dropdown} Removed support for passing in a function for a particular instrumentation

**Impact**<br> Support for passing in a function for a particular instrumentation to the `getInstrumentations()` utility has been removed.

**Action**<br> None.
::::

::::{dropdown} Removed the `@elastic/opentelemetry-node/sdk` entry-point

**Impact**<br> The `@elastic/opentelemetry-node/sdk` entry-point has been removed for the 1.0.0 release.

**Action**<br> None.
::::

::::{dropdown} Temporarily removed the 'gcp' resource detector

**Impact**<br> The 'gcp' resource detector has been temporarily removed due to an issue that results in misleading tracing data.

**Action**<br> No action required. The detector will be re-added once the underlying issue is resolved.

Refer to [PR #703](https://github.com/elastic/elastic-otel-node/pull/703).
::::

## 0.7.0

::::{dropdown} Bumped min-supported node to `^18.19.0 || >=20.6.0`

**Impact**<br> The minimum-supported Node.js version has been raised to match coming releases of OpenTelemetry JS. This drops support for Node.js 14 and 16.

**Action**<br> Upgrade to Node.js 18.19.0 or later, or Node.js 20.6.0 or later.

Refer to [PR #584](https://github.com/elastic/elastic-otel-node/pull/584).
::::
