# Supported Technologies

## Node.js versions

Elastic OpenTelemety Node.js Distribution follows the runtime support table
specified in OpenTelemetry Node.js SDK which we can summarise in support
from Nodejs v14 and above. For more details you can check the [SDK README file](https://github.com/open-telemetry/opentelemetry-js?tab=readme-ov-file#supported-runtimes).

## Instrumentations

| Name                                     | Short description                                            | Reference |
| `@opentelemetry/instrumentation-http`    | Instruments Node.js `http` module for all supported versions |[README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-http#readme)|
| `@opentelemetry/instrumentation-express` | Instruments `express` package for version range `^4.0.0`     | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-express#readme)|
| `@opentelemetry/instrumentation-fastify` | Instruments `fastify` package for version range `>=3 <5`     | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-fastify#readme)|
| `@opentelemetry/instrumentation-ioredis` | Instruments `ioredis` package for version range `>=2 <6`     | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-ioredis#readme)|
| `@opentelemetry/instrumentation-pg`      | Instruments `pg` package for version range `>=8 <9`          | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-pg#readme)|
| `@opentelemetry/instrumentation-mongodb` | Instruments `mongodb` packages for version range `>=3.3 <7`  | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-mongodb#readme)|
| `@opentelemetry/instrumentation-bunyan`  | Instruments `bunyan` packages for version range `^1.0.0`     | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-bunyan#readme)|
| `@opentelemetry/instrumentation-wiston`  | Instruments `wiston` packages for version range `>1 <4`      | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-winston#readme)|

## ECMAScript Modules

TODO: which is the ESM suport? do we commit to something?
- 