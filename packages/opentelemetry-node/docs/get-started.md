<!--
Goal of this doc:
The user is able to successfully see data from their Node application make it to the Elastic UI via the Elastic Distribution for OpenTelemetry Node.js

Assumptions we're comfortable making about the reader:
* They are familiar with Elastic
* They are sending data to Elastic
* They have Node and NPM installed
-->

# Get started

> [!WARNING]
>  The Elastic Distribution for OpenTelemetry Node.js is not yet recommended for production use. Functionality may be changed or removed in future releases. Alpha releases are not subject to the support SLA of official GA features.
>
> We welcome your feedback! You can reach us by [opening a GitHub issue](https://github.com/elastic/elastic-otel-node/issues) or starting a discussion thread on the [Elastic Discuss forum](https://discuss.elastic.co/tags/c/observability/apm/58/nodejs).

This guide shows you how to use the Elastic Distribution for OpenTelemetry Node.js ("the distro")
to instrument your Node.js application and send OpenTelemetry data to an Elastic Observability deployment.

This doc will guide you through the minimal configuration options to get the Elastic distro set up in your application.
You do _not_ need any existing experience with OpenTelemetry to set up the Elastic distro initially.
If you need more control over your configuration after getting set up, you can learn more in [OpenTelemetry SDK documentation](https://opentelemetry.io/docs/languages/js).

> [!NOTE]
> As an OpenTelemetry SDK, the distro supports sending data to any OpenTelemetry protocol (OTLP) endpoint ([OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)), but this guide assumes you are sending data to Elastic.

<!-- ✅ What the user needs to know and/or do before they install the distro -->
## Prerequisites

Before getting started, you'll need somewhere to send the gathered OpenTelemetry data, so it can be viewed and analyzed. This doc assumes you're using an [Elastic Observability](https://www.elastic.co/observability) cloud deployment. You can use an existing one or set up a new one.

<details>
<summary><strong>Expand for setup instructions</strong></summary>

To create your first Elastic Observability deployment:

1. Sign up for a [free Elastic Cloud trial](https://cloud.elastic.co/registration) or sign into an existing account.
1. Go to <https://cloud.elastic.co/home>.
1. Click **Create deployment**.
1. When the deployment is ready, click **Open** to visit your Kibana home page (for example, `https://{DEPLOYMENT_NAME}.kb.{REGION}.cloud.es.io/app/home#/getting_started`).

</details>

<!-- ✅ How to install the distro -->
## Install

<!-- ✅ Step-by-step instructions -->
Install the `@elastic/opentelemetry-node` package:

```sh
npm install --save @elastic/opentelemetry-node
```

The distro is a single package that includes all the OpenTelemetry JS packages
that are needed for most cases.

<!-- TODO: refer to advanced section of "start the SDK" when we have that doc. -->

<!-- ✅ Start-to-finish operation -->
## Send data to Elastic

After installing the distro, configure and initialize it to start
sending data to Elastic.

<!-- ✅ Provide _minimal_ configuration/setup -->
### Configure the distro

<!-- ✅ Step-by-step instructions -->
To configure the distro, at a minimum you'll need your Elastic Observability cloud deployment's OTLP endpoint and
authorization data to set the appropriate `OTLP_*` environment variables:

* `OTEL_EXPORTER_OTLP_ENDPOINT`: The full URL of the endpoint where data will be sent.
* `OTEL_EXPORTER_OTLP_HEADERS`: A comma-separated list of `key=value` pairs that will be added to the headers of every request. This is typically this is used for authentication information.

You can find the values of these variables in Kibana's APM tutorial.
In Kibana:

1. Search for _APM Tutorial_.
1. Scroll down to the _APM Agents_ section and select the **OpenTelemetry** tab.
1. The appropriate values for `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` are shown there. For example:
    ```sh
    export OTEL_EXPORTER_OTLP_ENDPOINT=https://my-deployment.apm.us-west1.gcp.cloud.es.io
    export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer P....l"
    ```

![Kibana's APM tutorial showing OTel settings](./img/otlp-endpoint-settings.png)

For more information on all the available configuration options, refer to [Configuration](./configure.md).

<!-- ✅ Start sending data to Elastic -->
### Initialize the distro

For the distro to automatically instrument modules used by your Node.js service,
it must be started before you `require` your service code's dependencies --
for example, before `express` or `http` are loaded.

<!-- ✅ Step-by-step instructions -->
The recommended way to get the
distro started is by using the `-r, --require` Node.js
[CLI option](https://nodejs.org/api/cli.html#-r---require-module):

```sh
node --require @elastic/opentelemetry-node my-service.js
```

The distro will automatically instrument popular modules (listed in [Supported technologies](./supported-technologies.md))
used by your service, and send traces, metrics, and logs telemetry data (using
OTLP) to your configured observability backend.

<!-- TODO: link to a reference section on other ways to start the distro once we have those docs. -->

<!-- ✅ What success looks like -->
## Confirm that the distro is working

To confirm that the distro has successfully connected to Elastic:

1. Go to **APM** → **Services**.
1. You should see the name of the service to which you just added the distro. It can take several minutes after initializing the distro for the service to show up in this list.
1. Click on the name in the list to see trace data.
    > ![NOTE]
    > There may be no trace data to visualize unless you have _used_ your application since initializing the distro.

> [!TIP]
> Alternatively, if you are able to see the stdout from your service, you can look for an "INFO" level log message, `start Elastic Distribution for OpenTelemetry Node.js`, at startup to confirm that the distro is up and running.

<!-- ✅ What they should do next -->
## Next steps

* Learn how to configure the distro and browse all [configuration options](./configure.md).
* Learn more about viewing and interpreting APM data in the [Observability guide](https://elastic.co/guide/en/observability/current/apm.html).
* Have a question? Start a discussion thread on the [Elastic Discuss forum](https://discuss.elastic.co/tags/c/observability/apm/58/nodejs).
<!-- TODO: Link to a more specific OpenTelemetry <-> Elastic Observability doc if/when it exists -->
<!-- TODO: Link to advanced usage when we have that doc -->
