<!--
Goal of this doc:
Provide a reference of how to switch from `elastic-apm-node`, the classic agent, to `@elastic/opentelemetry-node`. It also
provide guide on passing their ELASTIC_* instrumentation config to EDOT

Assumptions we're comfortable making about the reader:
* They are just starting the agent in any form (REVIEW)
* They are not using any apm, transaction or span APIs (REVIEW)

-->

# Migration from Elastic APM Node.js Agent

This guide shows you how to _migrate_ a service instrumented with Elastic APM Node.js Agent
(classic Agent) with a basic setup to Elastic Distribution of OpenTelemetry Node.js (EDOT Node.js). If your
application is not instrumented with the classic agent please visit
our [get started](./get-started.md) guide in this documentation.


<!-- ✅ What the user needs to know and/or do before they migrate EDOT Node.js -->
## Prerequisites

Before getting started, you'll need to save a minimal set of configuration options from the classic Agent, so
EDOT Node.js can send data to the same deployment of [Elastic Observability](https://www.elastic.co/observability) using the same service name.

The mininmal set of options required for the migration are:

- [server url](https://www.elastic.co/guide/en/apm/agent/nodejs/4.x/configuration.html#server-url)
- [api key](https://www.elastic.co/guide/en/apm/agent/nodejs/4.x/configuration.html#api-key) or [secret token](https://www.elastic.co/guide/en/apm/agent/nodejs/4.x/configuration.html#secret-token)
- [service name](https://www.elastic.co/guide/en/apm/agent/nodejs/4.x/configuration.html#service-name) (optional)



<!-- ✅ Step-by-step instructions of the most common scenario -->
## Migration process

If the service being instrumented is not using any advanced feature like [Agent's APIs](https://www.elastic.co/guide/en/apm/agent/nodejs/4.x/api.html) the
migration process is straight-forward. This section will focus on this scenario and instructions for advanced usage
will be given in futeher sections.

### Uninstall Elastic APM Node.js Agent

Uninstall the `elastic-apm-node` package:

```sh
npm uninstall --save elastic-apm-node
```

Once the pacakge is removed you should proceed to remove any setup made to start the classic agent along with your service.

- remove Node.js `--require` CLI option `NODE_OPTIONS` or the start command if your service is using [Node.js CLI option](https://www.elastic.co/guide/en/apm/agent/nodejs/4.x/starting-the-agent.html#start-option-node-require-opt) start method.
- remove start snippet if your service is starting the agent with one of this options
  * [require('elastic-apm-node').start(...)](https://www.elastic.co/guide/en/apm/agent/nodejs/4.x/starting-the-agent.html#start-option-require-and-start)
  * [require('elastic-apm-node/start')](https://www.elastic.co/guide/en/apm/agent/nodejs/4.x/starting-the-agent.html#start-option-require-start-module)
- remove the APM module if your service is using [separate APM init module](https://www.elastic.co/guide/en/apm/agent/nodejs/4.x/starting-the-agent.html#start-option-separate-init-module)

### 2. Install EDOT Node.js

Install the `@elastic/opentelemetry-node` package:

```sh
npm install --save @elastic/opentelemetry-node
```

Like Elastic APM Node.js Agent EDOT Node.js is a single package that includes all the
OpenTelemetry JS packages that are needed for most cases.

Once you have the package installed is time to setup the start proces. The recommended way 
of starting EDOT Node.js along your application is via `--require` CLI option.

```sh
node --require @elastic/opentelemetry-node my-service.js
```

<!-- ✅ How to change the configuration -->
## Configuration of EDOT Node.js

Once you're done with the changes described in the section above it is time to migrate the configuration. EDOT Node.js is
typically configured with `OTEL_*` environment variables defined by the OpenTelemetry spec. Environment variables
are read at startup and can be used to configure EDOT Node.js.

For the minimal configuration mentioned in [prerequisites](#prerequisites) section there are `OTEL_*` variables
from OpenTelemetry spec that fit.

- `OTEL_EXPORTER_OTLP_ENDPOINT` will hold the value of `server_url` configuration option
- `OTEL_EXPORTER_OTLP_HEADERS` will hold the value of `api_key` or `secret_token`
  * the value should be `Authorization=Bearer {secret_token}` if `secret_token` was used
  * the value should be `Authorization=ApiKEy {api_key}` if `api_key` was used

If you want more information about configuration you may visit [configuration options](./configure.md) page.



## Advanced

There might be some cases where the instrumentation 

### Using classic Agent's APIs

If you are doing manual instrumentation of some modules of your service through the [classic Agent's API](https://www.elastic.co/guide/en/apm/agent/nodejs/4.x/api.html)
you will need to refactor it to use `@opentelemetry/api` methods.

Either if you're using `apm.startTransaction` or `apm.startSpan` APIs both could be refactor to the same instrumentation
code using `@opentelemetry/api`. The anatomy of a manual instrumentation using the classig Agent consists in
using `apm.startTransaction` or `apm.startSpan` to mark the beginning of a transaction/span and mark the end
by calling the `.end` API of the transaction or spans returned before.

Example:
```js
// file: my-service.js
//
// NOTE: we're assuming this app is started using Node.js --require CLI option
//   node --require elastic-apm-agent my-service.js
const http = require('http');
const apm = require('elastic-apm-agent');

const server = http.createServer(function onRequest(req, res) {
    // Start of manual instrumentation
    const span = apm.startSpan('Custom Span')

    console.log('incoming request: %s %s %s', req.method, req.url, req.headers);
    req.resume();
    req.on('end', function () {
        const body = 'pong';
        res.writeHead(200, {
            'content-type': 'text/plain',
            'content-length': Buffer.byteLength(body),
        });
        res.end(body);
        // Instrumentation end
        span.end();
    });
});

server.listen(3000, '127.0.0.1', function () {
    console.log('listening at', server.address());
});
```

To migrate this code to use `@opentelemetry/api` instead you should:

- remove the require call of `elastic-apm-node`
- require `@opentelemetry/api` and get a tracer
- replace usage of the classic Agent's API with call to the tracer API

```js
// file: my-service.js
//
// NOTE: we're assuming this app is started using Node.js --require CLI option
//   node --require @elastic/otel-node my-service.js

const http = require('http');
// Require OTEL API
const api = require('@opentelemetry/api');
// Get a tracer for our manual instrumentation
const tracer = api.tracer.getTracer();

const server = http.createServer(function onRequest(req, res) {
    // Start of manual instrumentation. In OTEL is always starting an Span
    tracer.startActiveSpan('Custom Span', function (span) {  // <-- the measured logic should be wrapped in this callback
      console.log('incoming request: %s %s %s', req.method, req.url, req.headers);
      req.resume();
      req.on('end', function () {
          const body = 'pong';
          res.writeHead(200, {
              'content-type': 'text/plain',
              'content-length': Buffer.byteLength(body),
          });
          res.end(body);
          // Instrumentation end
          span.end();
      });
    });
});

server.listen(3000, '127.0.0.1', function () {
    console.log('listening at', server.address());
});
```


### Extensive use of config options

TODO: review classic agent config options and add here the ones that can be migrated to OTEL env vars


## FAQ

- Will I get the same traces and metrics once the servie is migrated to EDOT Node.js?

TODO: point to supported technologies and metrics documents

- ????
