A mock OTLP server/receiver for development.

`mockotlpserver` starts HTTP and gRPC servers (on the default ports) for
receiving OTLP requests. The data in those requests are printed to the
console. Various output formats are supported.

# Install

(This package is not yet published to npm, so you'll need a clone of
this repo.)

    git clone git@github.com:elastic/elastic-otel-node.git
    cd elastic-otel-node
    npm ci
    cd packages/mockotlpserver

# CLI Usage

To use the mock server, (a) start the server then (b) send OTLP data to it.

    npm start  # or 'node lib/cli.js'

By default it will output received OTLP data using Node.js's `inspect`
format (used under the hood for `console.log`). This shows the complete
object structure of the received data. For example, using an example script
that uses the OpenTelemetry NodeSDK to trace an HTTP request/response:

    cd examples/
    node -r ./telemetry.js simple-http-request.js

<details>
<summary>will yield output close to the following:</summary>

```
% node lib/mockotlpserver.js
{"name":"mockotlpserver","level":30,"msg":"OTLP/HTTP listening at http://[::1]:4318","time":"2023-12-22T04:32:39.016Z"}
{"name":"mockotlpserver","level":30,"msg":"OTLP/gRPC listening at http://localhost:4317","time":"2023-12-22T04:32:39.019Z"}
{"name":"mockotlpserver","level":30,"msg":"UI listening at http://localhost:8080","time":"2023-12-22T04:32:39.019Z"}
ExportTraceServiceRequest {
  resourceSpans: [
    ResourceSpans {
      scopeSpans: [
        ScopeSpans {
          spans: [
            Span {
              attributes: [
                KeyValue { key: 'http.url', value: AnyValue { stringValue: 'http://localhost:3000/' } },
                KeyValue { key: 'http.host', value: AnyValue { stringValue: 'localhost:3000' } },
                KeyValue { key: 'net.host.name', value: AnyValue { stringValue: 'localhost' } },
                KeyValue { key: 'http.method', value: AnyValue { stringValue: 'GET' } },
                KeyValue { key: 'http.scheme', value: AnyValue { stringValue: 'http' } },
                KeyValue { key: 'http.target', value: AnyValue { stringValue: '/' } },
                KeyValue { key: 'http.flavor', value: AnyValue { stringValue: '1.1' } },
                KeyValue { key: 'net.transport', value: AnyValue { stringValue: 'ip_tcp' } },
                KeyValue { key: 'net.host.ip', value: AnyValue { stringValue: '::1' } },
                KeyValue { key: 'net.host.port', value: AnyValue { intValue: Long { low: 3000, high: 0, unsigned: false } } },
                KeyValue { key: 'net.peer.ip', value: AnyValue { stringValue: '::1' } },
                KeyValue { key: 'net.peer.port', value: AnyValue { intValue: Long { low: 62614, high: 0, unsigned: false } } },
                KeyValue { key: 'http.status_code', value: AnyValue { intValue: Long { low: 200, high: 0, unsigned: false } } },
                KeyValue { key: 'http.status_text', value: AnyValue { stringValue: 'OK' } }
              ],
              events: [],
              links: [],
              traceId: Buffer(16) [Uint8Array] [
                218, 252, 159, 205, 143,  43,
                 13,  82,  26, 194,  84, 158,
                 12, 241,  97,  50
              ],
              spanId: Buffer(8) [Uint8Array] [
                235, 244, 225,
                251, 215, 244,
                158,  97
              ],
              parentSpanId: Buffer(8) [Uint8Array] [
                192, 254, 88, 214,
                252, 178, 90, 110
              ],
              name: 'GET',
              kind: 2,
              startTimeUnixNano: Long { low: -1485868864, high: 396561708, unsigned: true },
              endTimeUnixNano: Long { low: -1481201225, high: 396561708, unsigned: true },
              droppedAttributesCount: 0,
              droppedEventsCount: 0,
              droppedLinksCount: 0,
              status: Status { code: 0 }
            },
            Span {
              attributes: [
                KeyValue { key: 'http.url', value: AnyValue { stringValue: 'http://localhost:3000/' } },
                KeyValue { key: 'http.method', value: AnyValue { stringValue: 'GET' } },
                KeyValue { key: 'http.target', value: AnyValue { stringValue: '/' } },
                KeyValue { key: 'net.peer.name', value: AnyValue { stringValue: 'localhost' } },
                KeyValue { key: 'http.host', value: AnyValue { stringValue: 'localhost:3000' } },
                KeyValue { key: 'net.peer.ip', value: AnyValue { stringValue: '::1' } },
                KeyValue { key: 'net.peer.port', value: AnyValue { intValue: Long { low: 3000, high: 0, unsigned: false } } },
                KeyValue {
                  key: 'http.response_content_length_uncompressed',
                  value: AnyValue { intValue: Long { low: 4, high: 0, unsigned: false } }
                },
                KeyValue { key: 'http.status_code', value: AnyValue { intValue: Long { low: 200, high: 0, unsigned: false } } },
                KeyValue { key: 'http.status_text', value: AnyValue { stringValue: 'OK' } },
                KeyValue { key: 'http.flavor', value: AnyValue { stringValue: '1.1' } },
                KeyValue { key: 'net.transport', value: AnyValue { stringValue: 'ip_tcp' } }
              ],
              events: [],
              links: [],
              traceId: Buffer(16) [Uint8Array] [
                218, 252, 159, 205, 143,  43,
                 13,  82,  26, 194,  84, 158,
                 12, 241,  97,  50
              ],
              spanId: Buffer(8) [Uint8Array] [
                192, 254, 88, 214,
                252, 178, 90, 110
              ],
              name: 'GET',
              kind: 3,
              startTimeUnixNano: Long { low: -1494868864, high: 396561708, unsigned: true },
              endTimeUnixNano: Long { low: -1478129996, high: 396561708, unsigned: true },
              droppedAttributesCount: 0,
              droppedEventsCount: 0,
              droppedLinksCount: 0,
              status: Status { code: 0 }
            }
          ],
          scope: InstrumentationScope { attributes: [], name: '@opentelemetry/instrumentation-http', version: '0.45.1' }
        }
      ],
      resource: Resource {
        attributes: [
          KeyValue { key: 'service.name', value: AnyValue { stringValue: 'simple-http-request' } },
          KeyValue { key: 'telemetry.sdk.language', value: AnyValue { stringValue: 'nodejs' } },
          KeyValue { key: 'telemetry.sdk.name', value: AnyValue { stringValue: 'opentelemetry' } },
          KeyValue { key: 'telemetry.sdk.version', value: AnyValue { stringValue: '1.19.0' } },
          KeyValue { key: 'process.pid', value: AnyValue { intValue: Long { low: 20595, high: 0, unsigned: false } } },
          KeyValue { key: 'process.executable.name', value: AnyValue { stringValue: 'node' } },
          KeyValue {
            key: 'process.executable.path',
            value: AnyValue { stringValue: '/Users/trentm/.nvm/versions/node/v18.18.2/bin/node' }
          },
          KeyValue {
            key: 'process.command_args',
            value: AnyValue {
              arrayValue: ArrayValue {
                values: [
                  AnyValue { stringValue: '/Users/trentm/.nvm/versions/node/v18.18.2/bin/node' },
                  AnyValue { stringValue: '-r' },
                  AnyValue { stringValue: './telemetry.js' },
                  AnyValue {
                    stringValue: '/Users/trentm/el/elastic-otel-node2/packages/mockotlpserver/examples/simple-http-request.js'
                  }
                ]
              }
            }
          },
          KeyValue { key: 'process.runtime.version', value: AnyValue { stringValue: '18.18.2' } },
          KeyValue { key: 'process.runtime.name', value: AnyValue { stringValue: 'nodejs' } },
          KeyValue { key: 'process.runtime.description', value: AnyValue { stringValue: 'Node.js' } },
          KeyValue {
            key: 'process.command',
            value: AnyValue {
              stringValue: '/Users/trentm/el/elastic-otel-node2/packages/mockotlpserver/examples/simple-http-request.js'
            }
          },
          KeyValue { key: 'process.owner', value: AnyValue { stringValue: 'trentm' } }
        ],
        droppedAttributesCount: 0
      }
    }
  ]
}
```

</details>

It will also dump a trace waterfall text representation of received tracing data.


## Different OTLP protocols

By default the NodeSDK uses the `OTLP/proto` protocol. The other flavours of OTLP
are supported by `mockotlpserver` as well. Use the `OTEL_EXPORTER_OTLP_PROTOCOL`
to tell the NodeSDK to use a different protocol:

```
OTEL_EXPORTER_OTLP_PROTOCOL=http/json node -r ./telemetry.js simple-http-request.js
OTEL_EXPORTER_OTLP_PROTOCOL=grpc      node -r ./telemetry.js simple-http-request.js
```

If you look carefully, you can see some differences in the representation of some fields
(startTimeUnixNano, traceId, spanId, etc.)

<!--
Try all the protocols:
    for flav in http/proto http/json grpc; do OTEL_EXPORTER_OTLP_PROTOCOL=$flav node -r ./telemetry.js simple-http-request.js; done
-->


## Different mockotlpserver printers

### json, json2

```
node lib/mockotlpserver.js -o json
node lib/mockotlpserver.js -o json2
```

Two other printers are `json` (0-space indentation) and `json2` (2-space
indentation). These emit a JSON representation of each request, with some
normalization applied:

- `attributes` are converted to a mapping for brevity
- `traceId`, `spanId`, `parentSpanId` are converted to a hex value
- `startTimeUnixNano`, `endTimeUnixNano` are converted to a string of a 64-bit integer
  (JavaScript's JSON.stringify cannot handle large 64-bit integers, so using
  Number can lose precision.)

### waterfall

This printer converts OTLP trace spans into a sort of "waterfall"
representation of the trace. The parent/child relationships are shown, along
with some span timing and other details.

```
# server
node lib/mockotlpserver.js -o inspect,waterfall

# example client
(cd examples; node -r ./telemetry.js simple-http-request.js)

# waterfall rendering
------ trace 299229 (2 spans) ------
       span 090dfe "GET" (14.5ms, SPAN_KIND_CLIENT, GET http://localhost:3000/ -> 200)
  +9ms `- span 90acc7 "GET" (3.4ms, SPAN_KIND_SERVER, GET http://localhost:3000/ -> 200)
```

The leading gutter shows the start time offset from the preceding span.
`` `- `` markers show parent/child relationships.


# Module usage

TODO: details coming

