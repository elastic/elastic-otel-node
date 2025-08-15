# @elastic/mockotlpserver Changelog

## Unreleased

- feat: Add a 'spacer' printer, and add it to the default set.
  This will print a blank line if it has been a "while" (currently 1s) since
  the last printed output. This helps in viewing the printed output.
  E.g. `node lib/cli.js -o summary,spacer`.

- chore: Excluding devDeps from Docker images should make them smaller.

- feat: Adds a log.debug() for every incoming HTTP and gRPC request.

## v0.8.0

- feat: 'summary' rendering of Sum and Gauge metric types
  (https://github.com/elastic/elastic-otel-node/pull/686)

- BREAKING CHANGE: Bump min-supported node to `^18.19.0 || >=20.6.0`.
  This raises the minimum-supported Node.js to the same as OpenTelemetry JS SDK 2.0.

## v0.7.0

- feat: add CLI option to tunnel all incoming requests to the given server. (https://github.com/elastic/elastic-otel-node/pull/608)

## v0.6.3

- Fix an alignment issue in the "gutter" of the trace-summary (waterfall) output
  when 1-char units are used (i.e. any time unit above "ms").

## v0.6.2

- Fix Docker publishing (permissions, context dir).

## v0.6.1

- Fix Docker publishing (git tag -> docker image tag handling).

## v0.6.0

- feat: Some improvements to "summary" styling. (https://github.com/elastic/elastic-otel-node/pull/459)
    - Show attributes for histogram metrics and handle showing multiple data points.
    - Bold "span", "event", "$metricType" in renderings, and style the name of that
      span/event/metric in magenta. See PR for screenshots.
- fix: Don't throw when printing a metrics summary for a histogram without attributes.
  (https://github.com/elastic/elastic-otel-node/pull/375)
- fix: Return a valid response to http/protobuf requests. Before this a picky exporter
  could complain about the invalid response data.
  (https://github.com/elastic/elastic-otel-node/issues/477)

## v0.5.0

- fix: Add shebang line to the CLI script so `npx @elastic/mockotlpserver` works.
- feat: Add `--log-level, -l LEVEL` option. E.g. `mockotlpserver -l warn` makes startup silent.
  Also add a `logLevel` option to the `MockOtlpServer` class for module usage.

## v0.4.1

(First version published to npm.)

- Fix "publishConfig" so npm publishing can work.

## v0.4.0

- Fix normalization of *empty* `kvlistValue` attributes.
- Improve "logs-summary" rendering of "Events" (log records with a `event.name`
  attribute) and log record `Body` fields that are multi-line strings or
  structured objects. Before this change the summary rendering was assuming
  the `Body` was a single-line string (typical of log record messages).
- Support `doubleValue` attributes.
- Support `bytesValue` attributes.
- Support `boolValue` attributes. I first saw this with:
    ```
    KeyValue { key: 'llm.is_streaming', value: AnyValue { boolValue: false } },
    ```
- Update opentelemetry-proto protos to v1.3.2.

## v0.3.0

- Update gRPC server to accept metrics (MetricsService) and logs (LogsService).
  (https://github.com/elastic/elastic-otel-node/pull/277)
- Added a start at better metrics support:
    - The `jsonN` output modes will some a somewhat normalized JSON
      representation (similar to what is done to normalize trace request data).
    - There is an experimental start at a `metrics-summary` printer:
      `node lib/cli.js -o waterfall,metrics-summary`.

## v0.2.0

- Added the ability to use the mock OTLP server as a module, so it can
  eventually be used in testing by other packages in this repo. The CLI
  has been separated out to "lib/cli.js".

    ```js
    const {MockOtlpServer} = require('@elastic/mockotlpserver');
    const otlpServer = new MockOtlpServer({
        onTrace: (trace) => { /* ... */ },
        // ... see code comment for other options.
    });
    otlpServer.start();

    // ...

    otlpServer.close();
    ```

    The `onTrace` option can be used to collect TraceServiceRequest
    data. Similar options exist for the other signals.

## v0.1.0

The status at commit 168e19c at the end of the OnWeek when David and
Trent hacked this together.
