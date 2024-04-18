# Metrics

## Enabled by default

In this distribution metrics are enabled by default and sent to the endpoint
configured by you. If you wish to disable metrics you can by setting the env
variable `ELASTIC_OTEL_METRICS_DISABLED` to the string `true`.

```sh
export ELASTIC_APM_SERVER_URL="https://apm-server-host.co"
export ELASTIC_APM_SECRET_TOKEN="secret_token"
export OTEL_EXPORTER_OTLP_ENDPOINT="${ELASTIC_APM_SERVER_URL}"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer ${ELASTIC_APM_SECRET_TOKEN}"
export ELASTIC_OTEL_METRICS_DISABLED=true
node -r @elastic/opentelemetry-node/start.js my-app.js
```

## Advanced Configuration

You can tune how often metrics data is exported to the endpoint and the max time
to export data you can use the env vars already defined in [the spec](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#periodic-exporting-metricreader).

## Host metrics

Elastic OpenTelemetry Node.js Distribution also gathers metrics from the host
machine with `@opentelemetry/host-metrics` pacakge.

TODO: maybe explain the metrics exported?