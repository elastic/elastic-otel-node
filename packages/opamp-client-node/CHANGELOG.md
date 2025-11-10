# @elastic/opamp-client-node Changelog

## v0.4.0

- BREAKING CHANGE: The `heartbeatIntervalSeconds` option to `createOpAMPClient`
  used to *clamp* the given value to `[100ms, 1d]`. Starting in this version,
  a value less than 100ms will **be ignored**, and the default value will be
  used. The reason for this is to ignore a possible accidental error case where
  *zero* or a negative number is provided, resulting in a too-fast 100ms
  interval. (The 100ms lower bound really only exists for faster testing. It
  is not a reasonable value for production.)

- Add `opampClient.setHeartbeatIntervalSeconds(num)` and
  `.resetHeartbeatIntervalSeconds()` methods for dynamically changing the
  heartbeat interval used by the OpAMP client. Values less than 100ms are
  ignored (with a log.warn) and values greater than 1d are clamped to 1d.
  [#1128](https://github.com/elastic/elastic-otel-node/issues/1128)

## v0.3.0

- Add TLS and mTLS support. [#1044](https://github.com/elastic/elastic-otel-node/issues/1044)

    ```js
    const client = createOpAMPClient({
        // ...
        connect: {
            ca: fs.readFileSync(path.join(CERTS_DIR, 'ca.crt')),
            cert: fs.readFileSync(path.join(CERTS_DIR, 'client.crt')),
            key: fs.readFileSync(path.join(CERTS_DIR, 'client.key')),
        }
    });
    ```

- Be more defensive in handling the `heartbeatIntervalSeconds` option: clamp to
  `[100ms, 1d]` and use the default (30s) for invalid values. The previous
  behaviour was to throw on invalid values, and to not have a max value.

## v0.2.0

- Publish types.

## v0.1.0

Initial release.
