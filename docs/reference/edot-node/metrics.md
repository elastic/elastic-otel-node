---
navigation_title: Metrics
description: Metrics produced by the Elastic Distribution of OpenTelemetry Node.js (EDOT Node.js).
applies_to:
  stack:
  serverless:
    observability:
  product:
    edot_node: ga
products:
  - id: cloud-serverless
  - id: observability
  - id: edot-sdk
---

# Metrics

By default, EDOT Node.js enables metric collection. Refer to the [settings with `METRIC` in the name](/reference/edot-node/configuration.md) for all options for configuring metric collection.

## Process and runtime metrics

EDOT Node.js gathers metrics from the Node.js process your application is
running using the following packages:

- `@opentelemetry/instrumentation-host-metrics` to gather `process.cpu.*` and `process.memory.*` metrics ([process metrics reference](https://github.com/open-telemetry/semantic-conventions/blob/80988c54712ee336cb3a6240b8845e9dfa8c9f49/docs/system/process-metrics.md?plain=1#L22)).
- `@opentelemetry/instrumentation-runtime-node` to gather `nodejs.eventloop.*` ([Node.js event loop metric definitions](https://github.com/open-telemetry/semantic-conventions/blob/80988c54712ee336cb3a6240b8845e9dfa8c9f49/model/nodejs/metrics.yaml)) and `v8js.*` ([V8 JS metric definitions](https://github.com/open-telemetry/semantic-conventions/blob/80988c54712ee336cb3a6240b8845e9dfa8c9f49/model/v8js/metrics.yaml)) metrics.

Process and runtime metrics are useful when you check the performance of your instrumented service.
A subset of them is useful to detect issues when you review the instrumented service. These are:

- `nodejs.eventloop.delay.p50` and `nodejs.eventloop.delay.p90` are the
  50th and 90th [percentiles](https://en.wikipedia.org/wiki/Percentile) of
  the event loop delay. The event loop delay measures the time span between
  the scheduling of a callback and its execution. The bigger the number,
  the more sync work you have in your service blocking the event loop.
- `nodejs.eventloop.utilization` is the utilization of the event loop reported
  by [`performance.eventLoopUtilization([utilization1[, utilization2]])`](https://nodejs.org/api/perf_hooks.html#performanceeventlooputilizationutilization1-utilization2) which gives
  the percentage of time the event loop is being used (not idle).
- `process.cpu.utilization` is the percentage of time the CPU is running
  the service code. Big values in this metric suggest your service is doing
  compute-intensive tasks.
- `process.memory.usage` is the value of [Resident Set Size](https://nodejs.org/api/process.html#processmemoryusagerss) in bytes. It
  measures how much memory the process allocates.

If EDOT Node.js instruments your service, or if your custom instrumentation includes the packages previously mentioned,
{{kib}} shows them as part of the [service metrics](docs-content://solutions/observability/apm/metrics-ui.md).

## Health metrics

Health metrics are internal metrics emitted by the OpenTelemetry Node.js SDK about its own operations, such as the number of exported spans, dropped spans, or spans that failed to send. EDOT Node.js is built on that SDK, so you can use these metrics to monitor the health of your telemetry pipeline.

To enable health metrics, set the `OTEL_NODE_EXPERIMENTAL_SDK_METRICS` environment variable to `true`:

```sh
OTEL_NODE_EXPERIMENTAL_SDK_METRICS=true node --import @elastic/opentelemetry-node my-app.js
```

:::{note}
`OTEL_NODE_EXPERIMENTAL_SDK_METRICS` is an experimental OpenTelemetry contrib feature and might change in future releases.
:::

### Manual SDK configuration

If you configure the OpenTelemetry Node.js SDK manually instead of using EDOT Node.js, pass a `MeterProvider` to each SDK component so that every component can emit health metrics:

```js
const metricExporter = new OTLPMetricExporter();
const metricReader = new PeriodicExportingMetricReader({ exporter: metricExporter });
const meterProvider = new MeterProvider({ metricReaders: [metricReader] });
metricExporter.setMeterProvider(meterProvider);

const traceExporter = new OTLPTraceExporter({ meterProvider });
const tracerProvider = new TracerProvider({
  processors: [new BatchSpanProcessor({ exporter: traceExporter, meterProvider })],
  meterProvider,
});

const logExporter = new OTLPLogExporter({ meterProvider });
const loggerProvider = new LoggerProvider({
  processors: [new BatchLogRecordProcessor({ exporter: logExporter, meterProvider })],
  meterProvider,
});
```

The `OTLPMetricExporter` requires you to set the `MeterProvider` after construction using `setMeterProvider()`, because the exporter itself needs to report health metrics but can only receive a `MeterProvider` once one exists.
