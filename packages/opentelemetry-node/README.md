# Elastic Distribution of OpenTelemetry Node.js

> [!WARNING]
> The Elastic Distribution of OpenTelemetry Node.js is not yet recommended for production use. Functionality may be changed or removed in future releases. Alpha releases are not subject to the support SLA of official GA features.
>
> We welcome your feedback! You can reach us by [opening a GitHub issue](https://github.com/elastic/elastic-otel-node/issues) or starting a discussion thread on the [Elastic Discuss forum](https://discuss.elastic.co/tags/c/observability/apm/58/nodejs).

The Elastic Distribution of OpenTelemetry Node.js (EDOT Node.js) is a lightweight wrapper around the [OpenTelemetry SDK for Node.js](https://opentelemetry.io/docs/languages/js) that makes it easier to get started using OpenTelemetry in your Node.js applications, especially if you are using [Elastic Observability](https://www.elastic.co/observability) as your observability solution.

> [!NOTE]
> For more details about OpenTelemetry distributions in general, visit the [OpenTelemetry documentation](https://opentelemetry.io/docs/concepts/distributions).

With EDOT Node.js you have access to all the features of the OpenTelemetry SDK for Node.js plus:

* Access to SDK improvements and bug fixes contributed by the Elastic team _before_ the changes are available upstream in the OpenTelemetry JavaScript repositories.
* A single package that includes several OpenTelemetry packages as dependencies, so you only need to install and update a single package (for most use cases). This is similar to OpenTelemetry's `@opentelemetry/auto-instrumentations-node` package.

<!-- I don't think we want to highlight this yet -->
<!-- * Providing an eventual easy migration path for customers of our current non-OpenTelemetry-based [Node.js APM agent](https://github.com/elastic/apm-agent-nodejs) to this SDK may be made easier by having our own package entry point. -->

Use EDOT Node.js to start the OpenTelemetry SDK with your Node.js application to automatically capture tracing data, performance metrics, and logs. EDOT Node.js will automatically instrument [popular modules](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/metapackages/auto-instrumentations-node#supported-instrumentations) used by your service, and send the data to your configured observability backend using the OpenTelemetry protocol (OTLP).

**Ready to try out EDOT Node.js?** Follow the step-by-step instructions in [Get started](./docs/get-started.md).

## Install

```sh
npm install --save @elastic/opentelemetry-node
```

## Run

```sh
node -r @elastic/opentelemetry-node my-service.js
```

## Read the docs

* [Get started](./docs/get-started.md)
* [Configure the distro](./docs/configure.md)
* [Supported technologies](./docs/supported-technologies.md)
* [Metrics](./docs/metrics.md)

## Limitations

We expect to support most every instrumentation included in [`@opentelemetry/auto-instrumentations-node`](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/metapackages/auto-instrumentations-node#supported-instrumentations). However, currently only a subset is supported. See [the supported instrumentations here](./docs/supported-technologies.md#instrumentations).
