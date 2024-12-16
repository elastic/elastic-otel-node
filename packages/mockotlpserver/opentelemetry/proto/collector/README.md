# OpenTelemetry Collector Proto

This package describes the OpenTelemetry collector protocol.

## Packages

1. `common` package contains the common messages shared between different services.
2. `trace` package contains the Trace Service protos.
3. `metrics` package contains the Metrics Service protos.
4. `logs` package contains the Logs Service protos.

### NOTE from Elastic Observability
The contents of these `.proto` files have been extracted from the repository
https://github.com/open-telemetry/opentelemetry-proto.git at the following tag/hash v1.4.0.

This will be kept in sync wth the version being used in opentelemetry-js repository
https://github.com/open-telemetry/opentelemetry-js.git
