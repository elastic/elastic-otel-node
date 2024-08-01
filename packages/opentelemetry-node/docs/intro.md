<!--
Goal of this doc:
Provide all the information a user needs to determine if the product is a good enough fit for their use case to merit further exploration

Assumptions we're comfortable making about the reader:
* They are familiar with Elastic
* They are familiar with OpenTelemetry
-->

# Introduction

> [!WARNING]
>  The Elastic Distribution for OpenTelemetry Node.js is not yet recommended for production use. Functionality may be changed or removed in future releases. Alpha releases are not subject to the support SLA of official GA features.
>
> We welcome your feedback! You can reach us by [opening a GitHub issue](https://github.com/elastic/elastic-otel-node/issues) or starting a discussion thread on the [Elastic Discuss forum](https://discuss.elastic.co/tags/c/observability/apm/58/nodejs).

<!-- ✅ Intro -->
The Elastic Distribution for OpenTelemetry Node.js ("the distro") is a Node.js package that provides:

* An easy way to instrument your application with OpenTelemetry.
* Configuration defaults for best usage.

<!-- ✅ What is it? -->
<!-- ✅ Why use it? -->
A _distribution_ is a customized version of an upstream OpenTelemetry repository with some customizations. The Elastic Distribution for OpenTelemetry Node.js is an extension of the [OpenTelemetry SDK for Node.js](https://opentelemetry.io/docs/languages/js). With the Elastic distro you have access to all the features of the OpenTelemetry SDK for Node.js plus:

* Access to SDK improvements and bug fixes contributed by the Elastic team _before_ the changes are available upstream in the OpenTelemetry JavaScript repositories.
* A single package that includes several OpenTelemetry packages as dependencies, so you only need to install and update a single package (for most use cases).
<!--* Preconfigures the collection of tracing and metrics signals, applying some opinionated defaults, such as which sources are collected by default. -->

> [!NOTE]
> For more details about OpenTelemetry distributions in general, visit the [OpenTelemetry documentation](https://opentelemetry.io/docs/concepts/distributions).

<!-- ✅ How to use it? -->
Use the distro to start the OpenTelemetry SDK with your Node.js application to automatically capture tracing data, performance metrics, and logs. Traces, metrics, and logs are sent to any OTLP collector you choose.

After you start sending data to Elastic, use an [Elastic Observability](https://www.elastic.co/guide/en/observability/current/index.html) deployment &mdash; hosted on Elastic Cloud or on-premises &mdash; to monitor your applications, create alerts, and quickly identify root causes of service issues.

<!-- ✅ What they should do next -->
**Ready to try out the distro?** Follow the step-by-step instructions in [Get started](./get-started.md).
