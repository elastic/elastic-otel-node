# EDOT Node.js

The Elastic Distribution of OpenTelemetry Node.js (EDOT Node.js) is a lightweight wrapper around the [OpenTelemetry SDK for Node.js](https://opentelemetry.io/docs/languages/js) that makes it easy to get started using OpenTelemetry in your Node.js applications, especially if you are using [Elastic Observability](https://www.elastic.co/observability) as your observability solution.

```bash
# Install it
npm install --save @elastic/opentelemetry-node

# Configure it
export OTEL_EXPORTER_OTLP_ENDPOINT="...your-OTLP/collector-endpoint..."
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=..."
export OTEL_SERVICE_NAME="my-app"

# Start it with your application
node --import @elastic/opentelemetry-node my-app.js
```

**See [the EDOT Node.js docs](https://elastic.github.io/opentelemetry/edot-sdks/nodejs/index.html) for details.**
Some direct links:

* [Get started](https://elastic.github.io/opentelemetry/edot-sdks/nodejs/setup/index.html)
* [Configuration](https://elastic.github.io/opentelemetry/edot-sdks/nodejs/configuration.html)
* [Changelog](https://github.com/elastic/elastic-otel-node/blob/main/packages/opentelemetry-node/CHANGELOG.md)
* [Elastic Discuss forum](https://discuss.elastic.co/tags/c/observability/apm/58/nodejs) | [GitHub issue tracker](https://github.com/elastic/elastic-otel-node/issues)


## How does EDOT Node.js differ from the OpenTelemetry JS SDK?

EDOT Node.js is very similar to the `@opentelemetry/auto-instrumentations-node` package from OpenTelemetry in its usage goal: a single-dependency that provides a simple path to zero-code instrumentation of Node.js applications. In general, Elastic's goal is to contribute all SDK improvements upstream. That said, there are sometimes differences that are specific to Elastic (e.g. talking to an Elastic service for central configuration, Elastic-authored additional instrumentations). Here is a concise list of differences:

- EDOT Node.js includes the additional, Elastic-authored [`@elastic/opentelemetry-instrumentation-openai`](../instrumentation-openai) instrumentation for the OpenAI Node.js client library.
- EDOT Node.js, being a [distribution](https://opentelemetry.io/docs/concepts/distributions/) of the OpenTelemetry JS SDK, always adds the [`telemetry.distro.*`](https://opentelemetry.io/docs/specs/semconv/attributes-registry/telemetry/) resource attributes to identify itself.
- EDOT Node.js [enables some metrics by default](https://github.com/elastic/elastic-otel-node/blob/main/packages/opentelemetry-node/docs/metrics.md) that are not included by `@opentelemetry/auto-instrumentations-node`: a subset of metrics from `@opentelemetry/host-metrics` and the metrics from `@opentelemetry/instrumentation-runtime-node`.
- EDOT Node.js defaults to [`OTEL_SEMCONV_STABILITY_OPT_IN=http`](https://opentelemetry.io/docs/specs/semconv/non-normative/http-migration/) such that telemetry from the `@opentelemetry/instrumentation-http` package will use stable HTTP semantic conventions by default. Upstream OpenTelemetry JS has [a tracking issue for the migration to newer HTTP semantic conventions](https://github.com/open-telemetry/opentelemetry-js/issues/5646) in its instrumentations.
- EDOT Node.js [defaults to `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta`](https://elastic.github.io/opentelemetry/edot-sdks/nodejs/configuration.html#otel_exporter_otlp_metrics_temporality_preference-details), which differs from the upstream OpenTelemetry JS default of `cumulative`.
- EDOT Node.js uses the more recent [import-in-the-middle `createAddHookMessageChannel` feature](https://github.com/nodejs/import-in-the-middle/blob/main/README.md#only-intercepting-hooked-modules) for improved ESM support. We hope to upstream support for this.
- Internal [diagnostic logging](https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/opentelemetry-sdk-node/README.md#configure-log-level-from-the-environment) from EDOT Node.js is in a custom JSON-log format, rather than the message-string-only format from OpenTelemetry JS. diag logging in (luggite) JSON format
- EDOT Node.js does not include [GCP resource detector](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/detectors/node/opentelemetry-resource-detector-gcp) due to an [issue](https://github.com/open-telemetry/opentelemetry-js-contrib/issues/2320) that causes the HTTP instrumentation to send spans from the detector as if they were from the instrumented service. This causes the UI to show wrong info and errors nonn related to the service.

