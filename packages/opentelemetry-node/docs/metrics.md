<!--
Goal of this doc:
The user understands which metrics are collected by default in EDOT and gets
insight on metrics export configurations.

Assumptions we're comfortable making about the reader:
* They are familiar with Elastic
* They are familiar with OpenTelemetry
* They have familiar with node runtime metrics
-->

# Metrics

## Enabled by default

In the Elastic Distribution for Node.js (EDOT Node.js) metrics are enabled by default and sent to the endpoint
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

## Process & runtime metrics

EDOT Node.js also gathers metrics from the nodejs process your application is
running. In order to do that EDOT Node.js is using the following packages:

- `@opentelemetry/host-metrics` to gather `process.cpu.*` and `process.memory.*` metrics ([ref](https://github.com/open-telemetry/semantic-conventions/blob/80988c54712ee336cb3a6240b8845e9dfa8c9f49/docs/system/process-metrics.md?plain=1#L22))
- `@opentelemetry/instrumentation-runtime-node` to gather `nodejs.eventloop.*` and `v8js.*` metrics ([ref](https://github.com/open-telemetry/semantic-conventions/blob/80988c54712ee336cb3a6240b8845e9dfa8c9f49/model/nodejs/metrics.yaml)) and `v8js.*` ([ref](https://github.com/open-telemetry/semantic-conventions/blob/80988c54712ee336cb3a6240b8845e9dfa8c9f49/model/v8js/metrics.yaml))

These metrics are useful when you're checking the performance of your
instrumented service. A subset of them are useful to detect possible
issues when doing an overview of the instrumented service. These are:

- `nodejs.eventloop.delay.p50` and `nodejs.eventloop.delay.p90` are the
  50-th and 90-th [percentiles](https://en.wikipedia.org/wiki/Percentile) of
  the event loop delay. The event loop delay measures the time span between
  the scheduling of a callback and its execution. The bigger then number
  the more sync work you have in your service blocking the event loop.
- `nodejs.eventloop.utilization` is the utiliation of the event loop reported
  by [`performance.eventLoopUtilization([utilization1[, utilization2]])`](https://nodejs.org/api/perf_hooks.html#performanceeventlooputilizationutilization1-utilization2) gives which
  percentage of time the event loop is being used (not idle).
- `process.cpu.utilization` is the percentage of time the CPU is running
  the service code. Big values in this metric suggest your service is doing
  compute intesive tasks.
- `process.memory.usage` is the value of [Resident Set Size](https://nodejs.org/api/process.html#processmemoryusagerss) in bytes. It
  measures how much memory the process is allocating.


If your service is instrumented EDOT Node.js, or a custom instrumentation that includes the packages mentioned above, Kibana will
display them as part of the [service metrics](https://www.elastic.co/guide/en/observability/current/apm-metrics.html) in its UI.