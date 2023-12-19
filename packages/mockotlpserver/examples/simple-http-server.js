// From: https://opentelemetry.io/docs/instrumentation/js/getting-started/nodejs/

// NOTE: For simplicity we added the instrumentation coee in the same file
// have a commmand line arg to decide the exporter?
const { NodeSDK } = require('@opentelemetry/sdk-node');
// const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-node');
const { OTLPTraceExporter: OTLPTraceExporterHttp } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPTraceExporter: OTLPTraceExporterProto } = require('@opentelemetry/exporter-trace-otlp-proto');
const { OTLPTraceExporter: OTLPTraceExporterGrpc } = require('@opentelemetry/exporter-trace-otlp-grpc');
const {
  getNodeAutoInstrumentations,
} = require('@opentelemetry/auto-instrumentations-node');

const sdk = new NodeSDK({
  // traceExporter: new ConsoleSpanExporter(),
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations({
    // To reduce noise in the console since we just want
    // http and mongodb spans
    "@opentelemetry/instrumentation-fs": {
      enabled: false,
    },
    "@opentelemetry/instrumentation-connect": {
      enabled:false,
    },
    "@opentelemetry/instrumentation-net": {
      enabled: false,
    },
    "@opentelemetry/instrumentation-dns": {
      enabled: false,
    }
  })],
});

sdk.start();

// TODO: add server code here :)
