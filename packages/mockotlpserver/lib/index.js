const luggite = require('./luggite');
const {startHttp} = require('./http');
const {startGrpc} = require('./grpc');
const {startUi} = require('./ui');
const {InspectPrinter} = require('./printers');

const log = luggite.createLogger({name: 'mockotlpserver'});

// Default hostname to 'localhost', because that is what `DEFAULT_COLLECTOR_URL`
// uses in the OTel core exporter packages. Note that 'localhost' can by IPv6
// '::1' or IPv4 '127.0.0.1', which can potentially cause confusion.
const DEFAULT_HOSTNAME = 'localhost';
const DEFAULT_HTTP_PORT = 4318;
const DEFAULT_GRPC_PORT = 4317;
const DEFAULT_UI_PORT = 8080;

// Start a server which accepts incoming OTLP/HTTP calls and publishes
// received request data to the `otlp.*` diagnostic channels.
// Handles `OTEL_EXPORTER_OTLP_PROTOCOL=http/proto` and
// `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`.
startHttp({
    log,
    hostname: DEFAULT_HOSTNAME,
    port: DEFAULT_HTTP_PORT,
});

// Start a server which accepts incoming OTLP/gRPC calls and publishes
// received request data to the `otlp.*` diagnostic channels.
// Handles `OTEL_EXPORTER_OTLP_PROTOCOL=grpc`.
// NOTE: to debug read this: https://github.com/grpc/grpc-node/blob/master/TROUBLESHOOTING.md
startGrpc({
    log,
    hostname: DEFAULT_HOSTNAME,
    port: DEFAULT_GRPC_PORT,
});

startUi({
    log,
    hostname: DEFAULT_HOSTNAME,
    port: DEFAULT_UI_PORT,
});

const printer = new InspectPrinter(log);
printer.subscribe();
