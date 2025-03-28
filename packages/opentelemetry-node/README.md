# EDOT Node.js

The Elastic Distribution of OpenTelemetry Node.js (EDOT Node.js) is a lightweight wrapper around the [OpenTelemetry SDK for Node.js](https://opentelemetry.io/docs/languages/js) that makes it easy to get started using OpenTelemetry in your Node.js applications, especially if you are using [Elastic Observability](https://www.elastic.co/observability) as your observability solution.

> [!NOTE]
> For more details about OpenTelemetry distributions in general, visit the [OpenTelemetry documentation](https://opentelemetry.io/docs/concepts/distributions).

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

See [the EDOT Node.js docs](https://elastic.github.io/opentelemetry/edot-sdks/nodejs/index.html) for details.

* [Get started](https://elastic.github.io/opentelemetry/edot-sdks/nodejs/setup/index.html)
* [Configuration](https://elastic.github.io/opentelemetry/edot-sdks/nodejs/configuration.html)
* [Changelog](https://github.com/elastic/elastic-otel-node/blob/main/packages/opentelemetry-node/CHANGELOG.md)
* [Elastic Discuss forum](https://discuss.elastic.co/tags/c/observability/apm/58/nodejs) | [GitHub issue tracker](https://github.com/elastic/elastic-otel-node/issues)

<!--

## How does EDOT Node.js differ from the OpenTelemetry JS SDK?

EDOT Node.js is very similar to the `@opentelemetry/auto-instrumentations-node` package from OpenTelemetry in its usage goal: a single-dependency that provides a simple path to zero-code instrumentation of Node.js applications. In general, Elastic's goal is to contribute all SDK improvements upstream. That said, there are sometimes differences that are specific to Elastic (e.g. talking to an Elastic service for central configuration, Elastic-authored additional instrumentations). Here is a (hopefully up-to-date) concise list of differences:

- instr-openai
- added `telemetry.distro.*` resource attributes
- feat: using IITM's `createAddHookMessageChannel` for improved ESM support
- diag logging in (luggite) JSON format
- OTEL_SEMCONV_STABILITY_OPT_IN=http, expected to be short-lived diff
- OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta
- metrics: host-metrics (subset of) and instr-runtime-node on by default

-->
