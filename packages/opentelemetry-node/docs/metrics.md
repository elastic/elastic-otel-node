<!-- Goal of this doc: ??? -->

# Metrics

## Enabled by default

In the Elastic Distribution for Node.js (the distro) metrics are enabled by default and sent to the endpoint
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
host machine with `@opentelemetry/host-metrics` package.
