const DEFAULT_HOSTNAME = '127.0.0.1';
const DEFAULT_HTTP_PORT = 4318;
const DEFAULT_GRPC_PORT = 4317;

const { startHttp } = require('./http');
const { startGrpc } = require('./grpc');

// Start a server which accepts incoming HTTP requests. Exporters supported:
// - @opentelemetry/exporter-trace-otlp-http (HTTP + JSON)
// - @opentelemetry/exporter-trace-otlp-proto (HTTP + protobuf)
startHttp({
  hostname: DEFAULT_HOSTNAME,
  port: DEFAULT_HTTP_PORT,
});

// Start a server which accepts incoming GRPC calls. Exporters supported:
// - @opentelemetry/exporter-trace-otlp-grpc
//
// NOTE: to debug read this: https://github.com/grpc/grpc-node/blob/master/TROUBLESHOOTING.md
startGrpc({
  hostname: DEFAULT_HOSTNAME,
  port: DEFAULT_GRPC_PORT,
})
