# Introduction

This is the official Node.js SDK OpenTelemetry distribution from Elastic. It is
a Node.js package that provides:
- easy way to instrument your App with OpenTelemetry
- configuration defaults for best usage
- utils on top the OTEL SDK for better customization

Use it to start OpenTelemetry SDK with your Node.js application to automatically
capture errors, tracing data, and performance metrics. Traces and metrics are sent
to the OTLP receiver of your choice, tipically a collector or even an Elastic
Observability deployment -- hosted in Elastic's cloud or in your own on-premises
deployment -- where you can monitor your application, create alerts, and quick
identify root causes of service issues.


# Getting Started

This package works with any OTLP endpoint, for example: an [OTel Collector](https://opentelemetry.io/docs/collector/),
but we recommend to use an Elastic Stack deployment. This is a deployment of
APM Server (which receives APM data from the APM agent running in your application),
Elasticsearch (the database that stores all APM data), and Kibana (the application
that provides the interface to visualize and analyze the data). If you do not already
have an Elastic deployment to use, follow [this APM Quick Start guide](https://www.elastic.co/guide/en/apm/guide/current/apm-quick-start.html)
to create a free trial on Elastic's cloud. From this deployment you will need
the APM **`serverUrl`** and **`secretToken`** (or a configured `apiKey`) to use
for configuring the APM agent.

Note: Since version 7.14, Elastic [supports OTLP natively](https://www.elastic.co/blog/native-opentelemetry-support-in-elastic-observability).

## Installation

```sh
npm install --save @elastic/opentelemetry-node
```

## Initialization

It’s important that the agent is started before you require **any** other modules
in your Node.js application - i.e. before express, http, etc.

The more straightforward way to get the SDK started is by using the `--require`
Node.js [CLI option](https://nodejs.org/api/cli.html#-r---require-module).

```sh
node --require @elastic/opentelemetry-node app.js
```

By default the SDK will send telemetry data via OpenTelemetry's protocol (OTLP)
to the configured endpoint (by default it sends to <http://localhost:4317>):


TODO: talk about the experimental loader

## Advanced configuration



```sh
export OTEL_EXPORTER_OTLP_ENDPOINT="${ELASTIC_APM_SERVER_URL}"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer ${ELASTIC_APM_SECRET_TOKEN}"
node -r @elastic/opentelemetry-node/start.js my-app.js
```

Or if using an API key, then:

```sh
export OTEL_EXPORTER_OTLP_ENDPOINT="${ELASTIC_APM_SERVER_URL}"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=ApiKey ${ELASTIC_APM_API_KEY}"
node -r @elastic/opentelemetry-node/start.js my-app.js
```


