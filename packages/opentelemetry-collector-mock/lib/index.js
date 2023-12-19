const DEFAULT_HOST = 'localhost';
const DEFAULT_HTTP_PORT = 4318;
const DEFAULT_GRPC_PORT = 4317;

const { startHttp } = require('./http');
const { startGrpc } = require('./grpc');

// Start a server which accepts incoming HTTP requests. Exporters supported:
// - @opentelemetry/exporter-trace-otlp-http (HTTP + JSON)
// - @opentelemetry/exporter-trace-otlp-proto (HTTP + protobuf)
startHttp({
  host: DEFAULT_HOST,
  port: DEFAULT_HTTP_PORT,
});

// Start a server which accepts incoming GRPC calls. Exporters supported:
// - @opentelemetry/exporter-trace-otlp-grpc
startGrpc({
  host: DEFAULT_HOST,
  port: DEFAULT_GRPC_PORT,
})
