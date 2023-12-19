const { resolve } = require('path');

const grpc = require('@grpc/grpc-js');
const loader = require('@grpc/proto-loader');

// TODO: for now `proto` files are copied from
// https://github.com/open-telemetry/opentelemetry-proto
// but maybe its better to have a submodule like otel-js does
const prefix = resolve(__dirname, '../opentelemetry/proto');
const pkgsBase = resolve(__dirname, '..');
const packages = {
  logs: '/collector/logs/v1/logs_service.proto',
  metrics: '/collector/metrics/v1/metrics_service.proto',
  trace: '/collector/trace/v1/trace_service.proto',
};

for (const [name, path] of Object.entries(packages)) {
  const definition = loader.loadSync(`${prefix}${path}`, { includeDirs: [pkgsBase] });
  const descriptor = grpc.loadPackageDefinition(definition);
  const namespace = descriptor.opentelemetry.proto.collector[name].v1

  packages[name] = namespace;
}

// helper functions

function intakeSpans(call, callback) {
  const spans = call.request;
  console.log('grpc spans', spans);
  callback(null, {
      partial_success: {
          rejected_spans: 0,
          error_message: '',
      }
  });
}

function intakeMetrics(call, callback) {
  // TODO: check proto
}

function intakeLogs(call, callback) {
  // TODO: check proto
}


/**
 * 
 * @param {Object} options
 * @param {string} options.host
 * @param {number} options.port
 */
function startGrpc(options) {
  const { port } = options;
  const grpcServer = new grpc.Server();

  console.log(packages.trace.TraceService)
  grpcServer.addService(packages.trace.TraceService.service, {
      Export: intakeSpans,
  });

  grpcServer.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), () => {
    console.log('grpc started', port);
    grpcServer.start();
  });
  
}


module.exports = {
  startGrpc,
};
