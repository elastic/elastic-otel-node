---
navigation_title: Elastic OTel Node.js
description: Introduction to the Elastic OTel Node.js.
applies_to:
  stack:
  serverless:
    observability:
  product:
    edot_node: ga
products:
  - id: cloud-serverless
  - id: observability
  - id: edot-sdk
  - id: apm-agent
---

# Elastic OTel Node.js [elastic-distribution-of-opentelemetry-nodejs]

The {{edot}} Node.js is a light wrapper around the [OpenTelemetry SDK for Node.js](https://opentelemetry.io/docs/languages/js), configured for the best experience with Elastic Observability.

Use Elastic OTel Node.js to start the OpenTelemetry SDK with your Node.js application, and automatically capture tracing data, performance metrics, and logs. Traces, metrics, and logs can be sent to any OpenTelemetry Protocol (OTLP) Collector you choose.

A goal of this distribution is to avoid introducing proprietary concepts in addition to those defined by the wider OpenTelemetry community. For any additional features introduced, Elastic aims at contributing them back to the OpenTelemetry project.

## Features

In addition to all the features of OpenTelemetry Node.js, with Elastic OTel Node.js you have access to the following:

* A single package that includes several OpenTelemetry packages as dependencies, so you only need to install and update a single package (for most use cases). This is similar to OpenTelemetry's `@opentelemetry/auto-instrumentations-node` package.
* Improvements and bug fixes contributed by the Elastic team before the changes are available in OpenTelemetry repositories.
* Optional features that can enhance OpenTelemetry data that is being sent to Elastic.
* Elastic-specific processors that ensure optimal compatibility when exporting OpenTelemetry signal data to an Elastic backend like an Elastic Observability deployment.
* Pre-configured collection of tracing and metrics signals, applying some opinionated defaults, such as which sources are collected by default. Additional metrics are collected by default: `process.cpu.*` and `process.memory.*` metrics from the [host-metrics instrumentation package](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-host-metrics/).
* Compatibility with APM Agent Central Configuration to modify the settings of the Elastic OTel Node.js SDK without having to restart the application.

Use Elastic OTel Node.js with your Node.js application to automatically capture distributed tracing data, performance metrics, and logs. Elastic OTel Node.js automatically instruments [popular modules](/reference/edot-node/supported-technologies.md#instrumentations) used by your service.

Follow the step-by-step instructions in [Setup](/reference/edot-node/setup/index.md) to get started.

## Release notes

For the latest release notes, including known issues, deprecations, and breaking changes, refer to [Elastic OTel Node.js release notes](/release-notes/index.md)
