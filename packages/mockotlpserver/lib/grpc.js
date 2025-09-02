/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {resolve} = require('path');

const grpc = require('@grpc/grpc-js');
const loader = require('@grpc/proto-loader');

const {
    diagchGet,
    CH_OTLP_V1_TRACE,
    CH_OTLP_V1_METRICS,
    CH_OTLP_V1_LOGS,
    CH_OTLP_V1_REQUEST,
} = require('./diagch');
const {Service} = require('./service');

const diagChReq = diagchGet(CH_OTLP_V1_REQUEST);

// TODO: for now `proto` files are copied from
// https://github.com/open-telemetry/opentelemetry-proto
// but maybe its better to have a submodule like otel-js does
const prefix = resolve(__dirname, '../opentelemetry/proto');
const pkgsBase = resolve(__dirname, '..');

// TODO: type si `any`since we mutate the properties to a diffrent type
// also we do not have type info from the proto files. Maybe we can provide
// a generic later
/** @type {any} */
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

/**
 * Creates a gRPC server interceptor to log incoming requests.
 *
 * @returns {grpc.ServerInterceptor}
 */
function createLoggingInterceptor(log) {
    return (methDesc, call) => {
        return new grpc.ServerInterceptingCall(call, {
            start: (next) => {
                next({
                    onReceiveMetadata: (metadata, mdNext) => {
                        log.debug(
                            {metadata},
                            `incoming gRPC req: ${methDesc.path}`
                        );
                        diagChReq.publish({
                            transport: 'grpc',
                            path: methDesc.path,
                            metadata: metadata,
                        });
                        mdNext(metadata);
                    },
                });
            },
        });
    };
}

function intakeTraces(call, callback) {
    callback(null, {
        partial_success: {
            rejected_spans: 0,
        },
    });
    // Publish *after* `callback(...response...)` to avoid delay and possible
    // crash in the message handlers.
    diagchGet(CH_OTLP_V1_TRACE).publish(call.request);
}

function intakeMetrics(call, callback) {
    callback(null, {
        partial_success: {
            rejected_spans: 0,
        },
    });
    // Publish *after* `callback(...response...)` to avoid delay and possible
    // crash in the message handlers.
    diagchGet(CH_OTLP_V1_METRICS).publish(call.request);
}

function intakeLogs(call, callback) {
    callback(null, {
        partial_success: {
            rejected_spans: 0,
        },
    });
    // Publish *after* `callback(...response...)` to avoid delay and possible
    // crash in the message handlers.
    diagchGet(CH_OTLP_V1_LOGS).publish(call.request);
}

class GrpcService extends Service {
    /**
     * @param {Object} opts
     * @param {import('./luggite').Logger} opts.log
     * @param {string} opts.hostname
     * @param {number} opts.port
     */
    constructor(opts) {
        super();
        this._opts = opts;
        this._grpcServer = null;
        this._port = null;
    }

    async start() {
        const {log, hostname, port} = this._opts;

        this._grpcServer = new grpc.Server({
            interceptors: [createLoggingInterceptor(log)],
        });
        this._grpcServer.addService(packages.trace.TraceService.service, {
            Export: intakeTraces,
        });
        this._grpcServer.addService(packages.metrics.MetricsService.service, {
            Export: intakeMetrics,
        });
        this._grpcServer.addService(packages.logs.LogsService.service, {
            Export: intakeLogs,
        });

        return new Promise((resolve, reject) => {
            this._grpcServer.bindAsync(
                `${hostname}:${port}`,
                grpc.ServerCredentials.createInsecure(),
                (err, boundPort) => {
                    if (err) {
                        reject(err);
                    } else {
                        this._port = boundPort;
                        resolve();
                    }
                }
            );
        });
    }

    get url() {
        return new URL(`http://${this._opts.hostname}:${this._port}`);
    }

    async close() {
        if (this._grpcServer) {
            this._grpcServer.forceShutdown();
        }
    }
}

module.exports = {
    GrpcService,
};
