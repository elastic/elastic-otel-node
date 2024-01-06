# @elastic/mockotlpserver Changelog

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
