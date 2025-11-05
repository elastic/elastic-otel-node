# @elastic/opamp-client-node Changelog

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
