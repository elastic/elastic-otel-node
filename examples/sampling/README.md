# Head-based sampling example

This directory shows an example of head-based sampling with EDOT Node.js.
Currently EDOT Node.js defaults to using the more recently specified
*Composite samplers*, which support the latest []`tracestate`-based
Probability Sampling](https://opentelemetry.io/docs/specs/otel/trace/tracestate-probability-sampling/).

Start service `a`, an HTTP service on port 3300.
This service will make an HTTP `GET /` to port 3301, and then respond successfully.
We are using `OTEL_TRACES_SAMPLER_ARG=0.5` to set the head-based sampling rate to 50%.

```
% npm run a

> sampling-example@1.0.0 a
> OTEL_TRACES_SAMPLER_ARG=0.5 OTEL_SERVICE_NAME=a node --env-file=./.env --import @elastic/opentelemetry-node service-a.js

{"name":"elastic-otel-node","level":30,"msg":"OTEL_METRICS_EXPORTER contains \"none\". Metric provider will not be initialized.","time":"2026-04-08T17:29:06.101Z"}
{"name":"elastic-otel-node","level":30,"preamble":true,"distroVersion":"1.9.0","system":{"os":"darwin 24.6.0","arch":"arm64","runtime":"Node.js v20.20.0"},"edotEnv":{"OTEL_SERVICE_NAME":"a","OTEL_TRACES_SAMPLER_ARG":"0.5","OTEL_METRICS_EXPORTER":"none","OTEL_NODE_DISABLED_INSTRUMENTATIONS":"dns,net,runtime-node","OTEL_NODE_RESOURCE_DETECTORS":"env,serviceinstance"},"configInfo":{"logLevel":"info"},"msg":"start EDOT Node.js","time":"2026-04-08T17:29:06.103Z"}
[a] listening: { address: '127.0.0.1', family: 'IPv4', port: 3300 }
```

Start service `b`, an HTTP service on port 3301.

```
% npm run b

> sampling-example@1.0.0 b
> OTEL_SERVICE_NAME=b node --env-file=./.env --import @elastic/opentelemetry-node service-b.js

{"name":"elastic-otel-node","level":30,"msg":"OTEL_METRICS_EXPORTER contains \"none\". Metric provider will not be initialized.","time":"2026-04-08T17:29:09.218Z"}
{"name":"elastic-otel-node","level":30,"preamble":true,"distroVersion":"1.9.0","system":{"os":"darwin 24.6.0","arch":"arm64","runtime":"Node.js v20.20.0"},"edotEnv":{"OTEL_SERVICE_NAME":"b","OTEL_METRICS_EXPORTER":"none","OTEL_NODE_DISABLED_INSTRUMENTATIONS":"dns,net,runtime-node","OTEL_NODE_RESOURCE_DETECTORS":"env,serviceinstance"},"configInfo":{"logLevel":"info"},"msg":"start EDOT Node.js","time":"2026-04-08T17:29:09.220Z"}
[b] listening: { address: '127.0.0.1', family: 'IPv4', port: 3301 }
```

Now call service `a`.

```
% npm run request

> sampling-example@1.0.0 request
> curl http://127.0.0.1:3300/ping
```

For a request that is *not* sampled, service `b` sees an incoming request like the following (with the sampled_flag=false in `traceparent`, the `-00`), and no spans are generated:

```
[b] incoming request: GET / {
  traceparent: '00-04cbb3f4b60b864bf474f68d639b4843-488557beebaf0381-00',
  host: '127.0.0.1:3301',
  connection: 'keep-alive'
}
```

For a request that *is* sampled, service `b` sees sampled_flag=true in traceparent `-01` **and** sees a `tracestate` with an OTel vendor section `ot=...` that gives the sampling rate `th:8` (per https://opentelemetry.io/docs/specs/otel/trace/tracestate-probability-sampling/#rejection-threshold-t and https://opentelemetry.io/docs/specs/otel/trace/tracestate-handling/#sampling-threshold-value-th):

```
[b] incoming request: GET / {
  traceparent: '00-2cd095b62938202c11b1142831293413-a5dff70aad257e73-01',
  tracestate: 'ot=th:8',
  host: '127.0.0.1:3301',
  connection: 'keep-alive'
}
```

The spans that are generated from this look something like:

```
span e4667a "GET" (3.0ms, SPAN_KIND_SERVER, GET -> 200, service.name=a, scope=http)
`- span a5dff7 "GET" (2.0ms, SPAN_KIND_CLIENT, GET http://127.0.0.1:3301/ -> 200, service.name=a, scope=http)
   `- span 843695 "GET" (0.8ms, SPAN_KIND_SERVER, GET -> 200, service.name=b, scope=http)
```

Here is a dump of the full OTLP span data from service `b` for that last span.
Note that the span data includes the tracestate: ` traceState: 'ot=th:8'`.

```
ExportTraceServiceRequest {
  resourceSpans: [
    ResourceSpans {
      scopeSpans: [
        ScopeSpans {
          spans: [
            Span {
              attributes: [
                KeyValue { key: 'http.request.method', value: AnyValue { stringValue: 'GET' } },
                KeyValue { key: 'url.scheme', value: AnyValue { stringValue: 'http' } },
                KeyValue { key: 'server.address', value: AnyValue { stringValue: '127.0.0.1' } },
                KeyValue { key: 'network.peer.address', value: AnyValue { stringValue: '127.0.0.1' } },
                KeyValue { key: 'network.peer.port', value: AnyValue { intValue: Long { low: 50428, high: 0, unsigned: false } } },
                KeyValue { key: 'network.protocol.version', value: AnyValue { stringValue: '1.1' } },
                KeyValue { key: 'url.path', value: AnyValue { stringValue: '/' } },
                KeyValue { key: 'client.address', value: AnyValue { stringValue: '127.0.0.1' } },
                KeyValue { key: 'server.port', value: AnyValue { intValue: Long { low: 3301, high: 0, unsigned: false } } },
                KeyValue { key: 'http.response.status_code', value: AnyValue { intValue: Long { low: 200, high: 0, unsigned: false } } }
              ],
              events: [],
              links: [],
              traceId: Buffer(16) [Uint8Array] [
                44, 208, 149, 182, 41, 56,
                32,  44,  17, 177, 20, 40,
                49,  41,  52,  19
              ],
              spanId: Buffer(8) [Uint8Array] [
                132,  54, 149, 210,
                212, 242, 173,  96
              ],
              traceState: 'ot=th:8',
              parentSpanId: Buffer(8) [Uint8Array] [
                165, 223, 247,  10,
                173,  37, 126, 115
              ],
              name: 'GET',
              kind: 2,
              startTimeUnixNano: Long { low: 610961408, high: 413430252, unsigned: true },
              endTimeUnixNano: Long { low: 611730617, high: 413430252, unsigned: true },
              droppedAttributesCount: 0,
              droppedEventsCount: 0,
              droppedLinksCount: 0,
              status: Status { code: 0 },
              flags: 769
            }
          ],
          scope: InstrumentationScope { attributes: [], name: '@opentelemetry/instrumentation-http', version: '0.213.0' }
        }
      ],
      resource: Resource {
        attributes: [
          KeyValue { key: 'service.instance.id', value: AnyValue { stringValue: '3f082e54-e3df-4b62-bab2-df0056f52bda' } },
          KeyValue { key: 'service.name', value: AnyValue { stringValue: 'b' } },
          KeyValue { key: 'telemetry.distro.name', value: AnyValue { stringValue: 'elastic' } },
          KeyValue { key: 'telemetry.distro.version', value: AnyValue { stringValue: '1.9.0' } },
          KeyValue { key: 'telemetry.sdk.language', value: AnyValue { stringValue: 'nodejs' } },
          KeyValue { key: 'telemetry.sdk.name', value: AnyValue { stringValue: 'opentelemetry' } },
          KeyValue { key: 'telemetry.sdk.version', value: AnyValue { stringValue: '2.6.0' } }
        ],
        droppedAttributesCount: 0
      }
    }
  ]
}
```
