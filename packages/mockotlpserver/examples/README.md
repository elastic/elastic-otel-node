Example scripts showing how to use `mockotlpserver`.

1. Start the Mock OTLP server:

    ```bash
    cd ..   # to the "packages/mockotlpserver" directory
    npm start
    ```

2. Run an example script, using `-r ./telemetry.js` to configure the OTel SDK.

    ```bash
    node -r ./telemetry.js simple-http-request.js
    ```

# Environment variable configuration

The "telemetry.js" script supports the normal OTel SDK environment variables.
<https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/>

Try `OTEL_EXPORTER_OTLP_PROTOCOL` to exercise `mockotlpserver`'s support for
them.

```
OTEL_EXPORTER_OTLP_PROTOCOL=grpc      node -r ./telemetry.js simple-http-request.js
OTEL_EXPORTER_OTLP_PROTOCOL=http/json node -r ./telemetry.js simple-http-request.js
// OTEL_EXPORTER_OTLP_PROTOCOL=http/proto is the default
```

Use `OTEL_LOG_LEVEL=debug` to get internal SDK diagnostic info:

```
OTEL_LOG_LEVEL=debug node -r ./telemetry.js simple-http-request.js
```
