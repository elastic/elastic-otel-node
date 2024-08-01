<!--
Goal of this doc:
???

Assumptions we're comfortable making about the reader:
- ???
- ???
- ???
-->

# Metrics

> [!WARNING]
>  The Elastic Distribution for OpenTelemetry Node.js is not yet recommended for production use. Functionality may be changed or removed in future releases. Alpha releases are not subject to the support SLA of official GA features.
>
> We welcome your feedback! You can reach us by [opening a GitHub issue](https://github.com/elastic/elastic-otel-node/issues) or starting a discussion thread on the [Elastic Discuss forum](https://discuss.elastic.co/tags/c/observability/apm/58/nodejs).

## Enabled by default

In this distribution metrics are enabled by default and sent to the endpoint
configured by you. If you wish to disable metrics you can by setting the env
variable `ELASTIC_OTEL_METRICS_DISABLED` to the string `true`.

```sh
export OTEL_EXPORTER_OTLP_ENDPOINT="${ELASTIC_APM_SERVER_URL}"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer ${ELASTIC_APM_SECRET_TOKEN}"
export ELASTIC_OTEL_METRICS_DISABLED=true
node -r @elastic/opentelemetry-node/start.js my-app.js
```

## Advanced configuration

You can tune how often metrics data is exported to the endpoint and the max time
to export data you can use the env vars already defined in [the spec](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#periodic-exporting-metricreader).

## Host metrics

The Elastic Distribution for OpenTelemetry Node.js also gathers metrics from the
host machine with `@opentelemetry/host-metrics` pacakge.
