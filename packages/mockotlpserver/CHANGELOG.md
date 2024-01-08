# @elastic/mockotlpserver Changelog

## Unreleased

- Added the ability to use the mock OTLP server as a module, so it can
  eventually be used in testing by other packages in this repo. The CLI
  has been separated out to "lib/cli.js".

    ```js
    const {MockOtlpServer} = require('@elastic/mockotlpserver');
    const otlpServer = new MockOtlpServer(/* ... */);
    otlpServer.start();
    // ...
    otlpServer.close();
    ```

    It isn't quite useable yet -- it needs some sugar to make receiving the
    OTLP data easier (rather than needing to know the internal diagnostic
    channel details).

## v0.1.0

The status at commit 168e19c at the end of the OnWeek when David and
Trent hacked this together.
