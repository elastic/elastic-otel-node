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

    cd ../../examples/
    node -r @elastic/opentelemetry-node simple-http-request.js

<details>
<summary>will yield output close to the following:</summary>

```
% node lib/cli.js
{"name":"mockotlpserver","level":30,"msg":"OTLP/HTTP listening at http://[::1]:4318/","time":"2024-01-11T22:18:49.017Z"}
{"name":"mockotlpserver","level":30,"msg":"OTLP/HTTP listening at http://localhost:4317/","time":"2024-01-11T22:18:49.025Z"}
{"name":"mockotlpserver","level":30,"msg":"UI listening at http://[::1]:8080/","time":"2024-01-11T22:18:49.026Z"}
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
                KeyValue { key: 'net.peer.port', value: AnyValue { intValue: Long { low: 61855, high: 0, unsigned: false } } },
                KeyValue { key: 'http.status_code', value: AnyValue { intValue: Long { low: 200, high: 0, unsigned: false } } },
                KeyValue { key: 'http.status_text', value: AnyValue { stringValue: 'OK' } }
              ],
              events: [],
              links: [],
              traceId: Buffer(16) [Uint8Array] [
                128,  35,  86,  43, 203,
                245, 130,  92,  63, 188,
                 74, 232, 155, 123, 212,
                222
              ],
              spanId: Buffer(8) [Uint8Array] [
                 34, 107, 247,  13,
                140, 202, 136, 107
              ],
              parentSpanId: Buffer(8) [Uint8Array] [
                240, 107,  26, 226,
                101, 131, 149,  15
              ],
              name: 'GET',
              kind: 2,
              startTimeUnixNano: Long { low: 448057536, high: 396978934, unsigned: true },
              endTimeUnixNano: Long { low: 452218144, high: 396978934, unsigned: true },
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
                KeyValue { key: 'http.response_content_length_uncompressed', value: AnyValue { intValue: Long { low: 4, high: 0, unsigned: false } } },
                KeyValue { key: 'http.status_code', value: AnyValue { intValue: Long { low: 200, high: 0, unsigned: false } } },
                KeyValue { key: 'http.status_text', value: AnyValue { stringValue: 'OK' } },
                KeyValue { key: 'http.flavor', value: AnyValue { stringValue: '1.1' } },
                KeyValue { key: 'net.transport', value: AnyValue { stringValue: 'ip_tcp' } }
              ],
              events: [],
              links: [],
              traceId: Buffer(16) [Uint8Array] [
                128,  35,  86,  43, 203,
                245, 130,  92,  63, 188,
                 74, 232, 155, 123, 212,
                222
              ],
              spanId: Buffer(8) [Uint8Array] [
                240, 107,  26, 226,
                101, 131, 149,  15
              ],
              name: 'GET',
              kind: 3,
              startTimeUnixNano: Long { low: 439057536, high: 396978934, unsigned: true },
              endTimeUnixNano: Long { low: 454517668, high: 396978934, unsigned: true },
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
          KeyValue { key: 'service.name', value: AnyValue { stringValue: 'unknown-node-service' } },
          KeyValue { key: 'telemetry.sdk.language', value: AnyValue { stringValue: 'nodejs' } },
          KeyValue { key: 'telemetry.sdk.name', value: AnyValue { stringValue: 'opentelemetry' } },
          KeyValue { key: 'telemetry.sdk.version', value: AnyValue { stringValue: '1.18.1' } },
          KeyValue { key: 'process.pid', value: AnyValue { intValue: Long { low: 82408, high: 0, unsigned: false } } },
          KeyValue { key: 'process.executable.name', value: AnyValue { stringValue: 'node' } },
          KeyValue { key: 'process.executable.path', value: AnyValue { stringValue: '/Users/trentm/.nvm/versions/node/v18.18.2/bin/node' } },
          KeyValue {
            key: 'process.command_args',
            value: AnyValue {
              arrayValue: ArrayValue {
                values: [
                  AnyValue { stringValue: '/Users/trentm/.nvm/versions/node/v18.18.2/bin/node' },
                  AnyValue { stringValue: '-r' },
                  AnyValue { stringValue: '@elastic/opentelemetry-node' },
                  AnyValue { stringValue: '/Users/trentm/el/elastic-otel-node/examples/simple-http-request.js' }
                ]
              }
            }
          },
          KeyValue { key: 'process.runtime.version', value: AnyValue { stringValue: '18.18.2' } },
          KeyValue { key: 'process.runtime.name', value: AnyValue { stringValue: 'nodejs' } },
          KeyValue { key: 'process.runtime.description', value: AnyValue { stringValue: 'Node.js' } },
          KeyValue { key: 'process.command', value: AnyValue { stringValue: '/Users/trentm/el/elastic-otel-node/examples/simple-http-request.js' } },
          KeyValue { key: 'process.owner', value: AnyValue { stringValue: 'trentm' } },
          KeyValue { key: 'host.name', value: AnyValue { stringValue: 'pink.local' } },
          KeyValue { key: 'host.arch', value: AnyValue { stringValue: 'amd64' } },
          KeyValue { key: 'host.id', value: AnyValue { stringValue: 'DF529BD4-274A-53F1-A84E-7F85AFD59258' } }
        ],
        droppedAttributesCount: 0
      }
    }
  ]
}
------ trace 802356 (2 spans) ------
       span f06b1a "GET" (15.5ms, SPAN_KIND_CLIENT, GET http://localhost:3000/ -> 200)
  +9ms `- span 226bf7 "GET" (4.2ms, SPAN_KIND_SERVER, GET http://localhost:3000/ -> 200)

```

</details>

It also shows a trace waterfall text representation of received tracing data.


## Different OTLP protocols

By default the NodeSDK uses the `OTLP/proto` protocol. The other flavours of OTLP
are supported by `mockotlpserver` as well. Use the `OTEL_EXPORTER_OTLP_PROTOCOL`
to tell the NodeSDK to use a different protocol:

```
cd ../../example
OTEL_EXPORTER_OTLP_PROTOCOL=http/json node -r @elastic/opentelemetry-node simple-http-request.js
OTEL_EXPORTER_OTLP_PROTOCOL=grpc      node -r @elastic/opentelemetry-node simple-http-request.js
```

If you look carefully, you can see some differences in the representation of some fields
(startTimeUnixNano, traceId, spanId, etc.).

**WARNING**: At the time of writing the Elastic OTel Node.js SDK distro only
supports the `OTLP/proto` flavour for *metrics* and *logs* exporting -- the
`OTEL_EXPORTER_OTLP_PROTOCOL` setting will be ignored. It is only the *trace*
exporter that currently honours that setting.

<!--
Try all the protocols:
    for flav in http/proto http/json grpc; do OTEL_EXPORTER_OTLP_PROTOCOL=$flav node -r @elastic/opentelemetry-node simple-http-request.js; done
-->


## Different mockotlpserver printers

There are a few groups of "printers" that format and write received OTLP data
to the console:
- `inspect` - Use Node.js's `util.inspect` to dump a complete and coloured representation.
- `json`, `json2` - Show a (somewhat normalized) JSON representation. The `2` means 2-space indentation.
- `summary` - An opinionated compact summary of the data.

Each of these printers can be limited to a particular signal by prefixing with
the signal. E.g. `node lib/cli.js -o logs-inspect,summary` will show full
"inspect" output for received Logs OTLP requests and summary output for all
signals.

Some notes on particular printers follow.

### json, json2

```
node lib/cli.js -o json   # 0-space indentation, i.e. compact
node lib/cli.js -o json2  # 2-space indentation
```

The JSON-related printers do some normalization of fields for convenience.

- `attributes` are converted to a mapping for brevity
- `traceId`, `spanId`, `parentSpanId` are converted to a hex value
- `startTimeUnixNano`, `endTimeUnixNano` are converted to a string of a 64-bit integer
  (JavaScript's JSON.stringify cannot handle large 64-bit integers, so using
  Number can lose precision.)
- Note: some others not mentioned here. See "lib/normalize.js" for details.

You can run `node lib/cli.js -o inspect,json` to compare the raw and normalized
JSON forms.

### trace-summary

This printer converts OTLP trace spans into a sort of "waterfall" representation
of the trace. The parent/child relationships are shown, along with some span
timing and other details.

```
# server
node lib/cli.js -o inspect,trace-summary

# example client
(cd ../../examples; node -r @elastic/opentelemetry-node simple-http-request.js)

# waterfall rendering
------ trace 299229 (2 spans) ------
       span 090dfe "GET" (14.5ms, SPAN_KIND_CLIENT, GET http://localhost:3000/ -> 200)
  +9ms `- span 90acc7 "GET" (3.4ms, SPAN_KIND_SERVER, GET http://localhost:3000/ -> 200)
```

- The leading gutter shows the start time offset from the preceding span.
- `` `- `` markers show parent/child relationships.
- Span and trace IDs (e.g. `299229`, `090dfe`) are trimmed to prefix for brevity.


# Module usage

The mock OTLP server can also be used in Node.js code (e.g. in a test suite).

```js
const {MockOtlpServer} = require('@elastic/mockotlpserver');
const otlpServer = new MockOtlpServer({
    onTrace: (trace) => { /* ... */ },
    // ... see code comment for other options.
});
otlpServer.start();

// Run code that sends telemetry via OTLP...

otlpServer.close();
```

See `runTestFixtures()` in "../opentelemetry-node/test/testutils.js" for a
more complete example.

