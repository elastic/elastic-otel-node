# Supported Technologies

## Elastic stack versions

The Elastic OpenTelemetry Distribution for Node.js (the "Distro") sends data
via OpenTelemetry protocol (OTLP). Since version 7.14, Elastic Observability [supports OTLP natively](https://www.elastic.co/blog/native-opentelemetry-support-in-elastic-observability).

Note that OpenTelemetry support is being improved in the 8.x versions of the
Elastic stack, so it is strongly recommended to be using a recent 8.x version.


## Node.js versions

The Elastic OpenTelemety Node.js Distribution supports Node.js v14 and later.
This follows from the [OpenTelemetry JS supported runtimes](https://github.com/open-telemetry/opentelemetry-js#supported-runtimes).


## Instrumentations

| Name                                     | Short description                                               | Reference |
| ---------------------------------------- | --------------------------------------------------------------- | --------- |
| `@opentelemetry/instrumentation-http`    | Instruments Node.js `http` module for all supported versions    | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-http#readme) |
| `@opentelemetry/instrumentation-express` | Instruments `express` package for version range `^4.0.0`        | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-express#readme) |
| `@opentelemetry/instrumentation-fastify` | Instruments `fastify` package for version range `>=3 <5`        | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-fastify#readme) |
| `@opentelemetry/instrumentation-ioredis` | Instruments `ioredis` package for version range `>=2 <6`        | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-ioredis#readme) |
| `@opentelemetry/instrumentation-pg`      | Instruments `pg` package for version range `>=8 <9`             | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-pg#readme) |
| `@opentelemetry/instrumentation-mongodb` | Instruments `mongodb` package for version range `>=3.3 <7`      | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-mongodb#readme) |
| `@opentelemetry/instrumentation-bunyan`  | Instruments `bunyan` package for version range `^1.0.0`         | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-bunyan#readme) |
| `@opentelemetry/instrumentation-winston` | Instruments `winston` package for version range `>1 <4`         | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-winston#readme) |
| `@opentelemetry/instrumentation-tedious` | Instruments `tedious` package for version range `>=1.11.0 <=15` | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/instrumentation-tedious#readme) |
| `@opentelemetry/instrumentation-undici`  | Instruments `undici` package for version range `>=5.12.0`       | [README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/instrumentation-undici#readme) |


## ECMAScript Modules (ESM)

This Distro includes *limited and experimental* support for instrumenting [ECMAScript module imports](https://nodejs.org/api/esm.html#modules-ecmascript-modules), i.e. modules that are loaded via `import ...` statements and `import('...')` (dynamic import).

<!-- TODO: add this to the above paragraph once we have an esm.md doc:
See the [ECMAScript module support](./esm.md) document for details.
-->

Limitations:
- For Node.js `>=20.6.0 || >=18.19.0`, support for hooking `import`s is automatically enabled. For earlier versions of Node.js, you must manually enable the `import`-hook via the `--experimental-loader=@elastic/opentelemetry-node/hook.mjs` option, e.g.: `node --experimental-loader=@elastic/opentelemetry-node/hook.mjs --require=@elastic/opentelemetry-node app.js`.
- Currently only a subset of instrumentations support ESM: `express`, `ioredis`, `koa`, `pg`, `pino`. See [this OpenTelemetry JS tracking issue](https://github.com/open-telemetry/opentelemetry-js-contrib/issues/1942) for progress.
