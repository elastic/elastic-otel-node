# Suported Technologies

## Node.js versions

Elastic OpenTelemety Node.js Distribution follows the runtime support table
specified in OpenTelemetry Node.js SDK which we can summarise in support
from Nodejs v14 and above. For more details you can check the [SDK README file](https://github.com/open-telemetry/opentelemetry-js?tab=readme-ov-file#supported-runtimes).

## ECMAScript Modules

TODO: which is the ESM suport? do we commit to something?

## Instrumentations


| Module    | Versions   | Note                                       | NPM URL                                                              |
| --------- | ---------- | ------------------------------------------ | -------------------------------------------------------------------- |
| `http`    | `>14`      | Version support refers to Node.js versions | https://www.npmjs.com/package/@opentelemetry/instrumentation-http    |
| `express` | `>=4 <5`   |                                            | https://www.npmjs.com/package/@opentelemetry/instrumentation-express |
| `fastify` | `>=3 <5`   |                                            | https://www.npmjs.com/package/@opentelemetry/instrumentation-fastify |
| `ioredis` | `>=2 <6`   |                                            | https://www.npmjs.com/package/@opentelemetry/instrumentation-ioredis |
| `pg`      | `>=8 <9`   |                                            | https://www.npmjs.com/package/@opentelemetry/instrumentation-pg      |
| `mongodb` | `>=3.3 <7` |                                            | https://www.npmjs.com/package/@opentelemetry/instrumentation-mongodb |
| `bunyan`  | `>=1 <2`   |                                            | https://www.npmjs.com/package/@opentelemetry/instrumentation-bunyan |
| `winston` | `>=1 <4`   |                                            | https://www.npmjs.com/package/@opentelemetry/instrumentation-winston |

## Host Metrics

TODO: is it necessary to tell about host metrics???