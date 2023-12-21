const {resolve} = require('path');

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
    const definition = loader.loadSync(`${prefix}${path}`, {
        includeDirs: [pkgsBase],
    });
    /** @type {any} */
    const descriptor = grpc.loadPackageDefinition(definition);
    const namespace = descriptor.opentelemetry.proto.collector[name].v1;

    descriptor.opentelemetry;

    packages[name] = namespace;
}

// helper functions

function intakeTraces(call, callback) {
    const tracesReq = call.request;
    // console.log('grpc spans', tracesReq);
    console.dir(tracesReq, {depth: 9});

    callback(null, {
        partial_success: {
            rejected_spans: 0,
        },
    });
}

// function intakeMetrics(call, callback) {
//   // TODO: check proto
// }

// function intakeLogs(call, callback) {
//   // TODO: check proto
// }

/**
 *
 * @param {Object} options
 * @param {string} options.hostname
 * @param {number} options.port
 */
function startGrpc(options) {
    const {hostname, port} = options;
    const grpcServer = new grpc.Server();

    grpcServer.addService(packages.trace.TraceService.service, {
        Export: intakeTraces,
    });

    grpcServer.bindAsync(
        `${hostname}:${port}`,
        grpc.ServerCredentials.createInsecure(),
        () => {
            console.log(`OTLP/gRPC listening at http://${hostname}:${port}`);
            grpcServer.start();
        }
    );
}

module.exports = {
    startGrpc,
};
