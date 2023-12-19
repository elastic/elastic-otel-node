const DEFAULT_HOST = 'localhost';
const DEFAULT_HTTP_PORT = 4318;
const DEFAULT_GRPC_PORT = 4317;

const { startHttp } = require('./http');
const { startGrpc } = require('./grpc');



function traces(traceData) {}

// Start a server which accepts incoming HTTP requests. Exporters supported:
// - @opentelemetry/exporter-trace-otlp-http (HTTP + JSON)
// - @opentelemetry/exporter-trace-otlp-proto (HTTP + protobuf)
const httpEmitter = startHttp({
  host: DEFAULT_HOST,
  port: DEFAULT_HTTP_PORT,
});

// Start a server which accepts incoming GRPC calls. Exporters supported:
// - @opentelemetry/exporter-trace-otlp-grpc
//
// NOTE: to debug read this: https://github.com/grpc/grpc-node/blob/master/TROUBLESHOOTING.md
startGrpc({
  host: DEFAULT_HOST,
  port: DEFAULT_GRPC_PORT,
})
