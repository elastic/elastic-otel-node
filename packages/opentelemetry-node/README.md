# Elastic OpenTelemetry Node.js Distribution

This is the Elastic OpenTelemetry Node.js Distribution.  It is a light wrapper
around the OpenTelemetry Node SDK that makes it easier to get started using
OpenTelemetry in your Node.js applications, especially if you are using [Elastic
Observability](https://www.elastic.co/observability) as your observability
solution.

# Current status

Pre-alpha

# Install

Eventually this will be `npm install @elastic/opentelemetry-node`.
However, while still in early development, this package is not yet published
to npm, so you'll need to access it via git:

    git clone https://github.com/elastic/elastic-otel-node.git
    cd elastic-otel-node/
    npm ci

and then install the package sub-directory:

    npm install .../elastic-otel-node/packages/opentelemetry-node

(TODO: update ^^ once published to npm.)


# Usage

To start the SDK, it must be loaded before any of your application code. The
recommended way to do that is via Node.js's [`-r, --require`
option](https://nodejs.org/api/all.html#all_cli_-r---require-module):

    node -r @elastic/opentelemetry-node my-app.js

TODO: Link to coming user guide for related topics: ES module support, configuration reference, starting the SDK via


# Configuring your telemetry endpoint

By default the SDK will send telemetry data via OpenTelemetry's protocol (OTLP)
to the configured endpoint (by default it sends to <http://localhost:4317>):

    OTEL_EXPORTER_OTLP_ENDPOINT=... \
        OTEL_EXPORTER_OTLP_HEADERS=... \
        node -r @elastic/opentelemetry-node my-app.js

You can send to any OTLP endpoint, for example: an [OTel Collector](https://opentelemetry.io/docs/collector/),
or directly to an Elastic Observability deployment. Since version 7.14, Elastic
[supports OTLP natively](https://www.elastic.co/blog/native-opentelemetry-support-in-elastic-observability).


### Elastic Observability endpoint

First, you will need an Elastic APM deployment. See: https://www.elastic.co/guide/en/apm/guide/current/apm-quick-start.html
You will need two pieces of information: the APM **server URL** (this is the OTLP endpoint) and your APM **secret code** (or **API key** if using API keys).
Then configure your

```sh
export OTEL_EXPORTER_OTLP_ENDPOINT="${ELASTIC_APM_SERVER_URL}"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer ${ELASTIC_APM_SECRET_TOKEN}"
node -r @elastic/opentelemetry-node my-app.js
```

Or if using an API key, then:

```sh
export OTEL_EXPORTER_OTLP_ENDPOINT="${ELASTIC_APM_SERVER_URL}"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=ApiKey ${ELASTIC_APM_API_KEY}"
node -r @elastic/opentelemetry-node my-app.js
```


### mockotlpserver endpoint

TODO: move this out to dev docs

If you don't yet have an OTLP endpoint setup and just want to see the SDK
working, you can run a *mock* OTLP server locally with the `mockotlpserver`
utility in this repository:

```sh
git clone https://github.com/elastic/elastic-otel-node.git
cd elastic-otel-node/
npm ci
cd packages/mockotlpserver
npm start
```

Now running an application with this SDK will send to the mock endpoint, which
prints out any received telemetry data, for example:

```sh
cd elastic-otel-node/examples
node -r @elastic/opentelemetry-node simple-http-request.js
```

See [the mockotlpserver README](../mockotlpserver#readme) for more details.



