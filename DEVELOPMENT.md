This document contains informal notes to help developers of the Elastic APM
Node.js agent. Developers should feel free to aggressively weed out obsolete
notes. For structured developer and contributing *rules and guidelines*, see
[CONTRIBUTING.md](./CONTRIBUTING.md).


### mockotlpserver OTLP endpoint

For local development, it can be useful to have an OTLP endpoint that is local,
and can show the exact details of data being sent by the OTel SDK. The
[mockotlpserver package](./packages/mockotlpserver/) in this repository
provides a CLI tool for this.

```sh
git clone https://github.com/elastic/elastic-otel-node.git
cd elastic-otel-node/
npm ci
cd packages/mockotlpserver
npm start -- --help  # mockotlpserver CLI options
npm start
```

This starts a service listening on the default OTLP/gRPC and OTLP/HTTP ports.
It will print received OTLP request data. By default it shows a raw print of
the protobuf request, e.g.:

```
ExportTraceServiceRequest {
  resourceSpans: [
    ResourceSpans {
      scopeSpans: [
        ScopeSpans {
          spans: [
            Span {
              attributes: [
                KeyValue { key: 'http.url', value: AnyValue { stringValue: 'http://localhost:3000/' } },
...
              name: 'GET',
              kind: 2,
...
```

and a "summary" compact representation of the request, e.g.:

```
------ trace 802356 (2 spans) ------
       span f06b1a "GET" (15.5ms, SPAN_KIND_CLIENT, GET http://localhost:3000/ -> 200)
  +9ms `- span 226bf7 "GET" (4.2ms, SPAN_KIND_SERVER, GET http://localhost:3000/ -> 200)
```

Try it with:

```sh
cd elastic-otel-node/examples
node -r @elastic/opentelemetry-node simple-http-request.js
```

See [the mockotlpserver README](./packages/mockotlpserver#readme) for more details.


# Logging tips

## logging

`OTEL_LOG_LEVEL=verbose` will turn on the most verbose-level logging in the SDK,
including enabling the core OpenTelemetry `diag` logger messages.

This distro's logging is currently in the JSON format used by the
[`luggite`](https://github.com/trentm/node-luggite) library. It be somewhat
pretty-formatted via the [`pino-pretty` tool](https://github.com/pinojs/pino-pretty):

    OTEL_LOG_LEVEL=verbose node myapp.js | pino-pretty

One of the important libs in the SDK is [require-in-the-middle](https://github.com/elastic/require-in-the-middle)
for intercepting `require(...)` statements for monkey-patching. You can get
debug output from it via:

    DEBUG=require-in-the-middle

And don't forget the node core [`NODE_DEBUG` and `NODE_DEBUG_NATIVE`](https://nodejs.org/api/all.html#cli_node_debug_module)
environment variables:

    NODE_DEBUG=*
    NODE_DEBUG_NATIVE=*

