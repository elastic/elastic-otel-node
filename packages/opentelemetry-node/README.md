# Elastic OpenTelemetry Distribution for Node.js

This is the Elastic OpenTelemetry Distribution for Node.js (the "Distro").
It is a light wrapper around the OpenTelemetry Node SDK that makes it easier to
get started using OpenTelemetry in your Node.js applications, especially if you
are using [Elastic Observability](https://www.elastic.co/observability) as your
observability solution.


# Current status

The current release is **alpha**, and not yet recommended for production use.
We welcome your feedback! You can reach us either on the [issue tracker](https://github.com/elastic/elastic-otel-node/issues)
or on [Elastic's Discuss forum](https://discuss.elastic.co/tags/c/observability/apm/58/nodejs).

Some limitations / notes:
- We expect to support most every instrumentation included in [`@opentelemetry/auto-instrumentations-node`](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/metapackages/auto-instrumentations-node#supported-instrumentations). However, currently only a subset is supported. See [the supported instrumentations here](./docs/supported-technologies.md#instrumentations).


# Usage

```sh
# 1. install
npm install --save @elastic/opentelemetry-node

# 2. configure via OTEL_ envvars, for example:
export OTEL_EXPORTER_OTLP_ENDPOINT=https://{your-otlp-endpoint.example.com}
export OTEL_EXPORTER_OTLP_HEADERS="Authorization={authorization-information}"
export OTEL_SERVICE_NAME=my-service

# 3. start
node -r @elastic/opentelemetry-node my-service.js
```

If using an [Elastic Observability deployment](./docs/getting-started.md#elastic-observability-setup)
to which to send telemetry data, the `OTEL_EXPORTER_*` settings will look
something like:

```sh
export OTEL_EXPORTER_OTLP_ENDPOINT=https://{deployment-name}.apm.{cloud-region}.cloud.es.io
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer {deployment-secret-token}"
```

The Distro will automatically instrument popular modules (see [supported instrumentations](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/metapackages/auto-instrumentations-node#supported-instrumentations)))
used by your service, and send trace, metrics, and logs telemetry data (using
OTLP) to your configured observability backend.

The Distro can be configured via `OTEL_*` environment variables, per the
[OpenTelemetry Environment Variable spec](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/).

See the [Getting Started guide](./docs/getting-started.md) for more details.


# Documentation

- [Getting Started](./docs/getting-started.md)
- [Supported Technologies](./docs/supported-technologies.md)
- [Metrics](./docs/metrics.md)


# Why this distribution?

As mentioned above, this Distro is a wrapper around the [OpenTelemetry Node
SDK (`@opentelemetry/sdk-node`)](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-sdk-node). So why the separate package?
A few reasons:

- With this separate package we hope to experiment with making it easier to get
  started with OpenTelemetry instrumentation in Node.js services. For example,
  `@elastic/opentelemetry-node` includes a number of OTel packages as dependencies,
  so the user only needs to install/update a single package -- at least for the
  default use case. This is similar to the OTel
  `@opentelemetry/auto-instrumentations-node` package.

- Having a separate package will sometimes allow us to iterate more quickly with
  changes in SDK behavior. However, our plan is to upstream any improvements to
  the OpenTelemetry JS repositories.

- Should it be necessary, having a separate package would allow us to more
  quickly release a fix for a particular issue required by a customer of ours.

- Providing an eventual easy migration path for customers of our current
  non-OpenTelemetry-based [Node.js APM agent](https://github.com/elastic/apm-agent-nodejs)
  to this SDK may be made easier by having our own package entry point.

