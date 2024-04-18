# Introduction

This is the Elastic OpenTelemetry Distribution for Node.js (the "Distro"). It is
a Node.js package that provides:
- easy way to instrument your application with OpenTelemetry
- configuration defaults for best usage
- utils on top the OTEL SDK for better customization

Use the Distro to start the OpenTelemetry SDK with your Node.js application to automatically
capture tracing data, performance metrics, and logs. Traces, metrics, and logs are sent
to any OTLP collector you choose. Use an [Elastic Observability](https://www.elastic.co/observability)
deployment -- hosted in Elastic's cloud or on-premises -- to monitor your applications, create alerts,
and quickly identify root causes of service issues.


# Getting Started

This package works with any OTLP endpoint, for example: an [OTel Collector](https://opentelemetry.io/docs/collector/),
but we recommend to use an Elastic Stack deployment. This is a deployment of
APM Server (which receives APM data from the APM agent running in your application),
Elasticsearch (the database that stores all APM data), and Kibana (the application
that provides the interface to visualize and analyze the data). If you do not already
have an Elastic deployment to use, follow [this APM Quick Start guide](https://www.elastic.co/guide/en/apm/guide/current/apm-quick-start.html)
to create a free trial on Elastic's cloud. From this deployment you will need
the APM **`serverUrl`** and **`secretToken`** (or a configured `apiKey`) to use
for configuring the SDK distribution.

Note: Since version 7.14, Elastic [supports OTLP natively](https://www.elastic.co/blog/native-opentelemetry-support-in-elastic-observability).

## Installation

```sh
npm install --save @elastic/opentelemetry-node
```

## Initialization

It’s important that the agent is started before you require **any** other modules
in your Node.js application - i.e. before express, http, etc.

The preferred way to get the SDK started is by using the `--require`
Node.js [CLI option](https://nodejs.org/api/cli.html#-r---require-module).

```sh
node --require @elastic/opentelemetry-node app.js
```

## Configuration

By default the SDK will send telemetry data via OpenTelemetry's protocol (OTLP)
to the configured endpoint (by default it sends to <http://localhost:4317>). The
endpoint configuration can be changed by setting the following environment vars:

- `OTEL_EXPORTER_OTLP_ENDPOINT`: full URL of the endpoint where to send the data.
- `OTEL_EXPORTER_OTLP_HEADERS`: coma separated list of `key=value` pairs which will
  be added to the headers of every request.


As an example if you want to send telemetry data to your Elastic's APM deployment you
may start the application like this

```sh
export ELASTIC_APM_SERVER_URL="https://apm-server-host.co"
export ELASTIC_APM_SECRET_TOKEN="secret_token"
export OTEL_EXPORTER_OTLP_ENDPOINT="${ELASTIC_APM_SERVER_URL}"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer ${ELASTIC_APM_SECRET_TOKEN}"
node -r @elastic/opentelemetry-node/start.js my-app.js
```

Or if using an API key, then:

```sh
export ELASTIC_APM_SERVER_URL="https://apm-server-host.co"
export ELASTIC_APM_API_KEY="api_key"
export OTEL_EXPORTER_OTLP_ENDPOINT="${ELASTIC_APM_SERVER_URL}"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=ApiKey ${ELASTIC_APM_API_KEY}"
node -r @elastic/opentelemetry-node/start.js my-app.js
```
