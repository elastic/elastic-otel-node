# @elastic/mockotlpserver Changelog

## untagged

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
