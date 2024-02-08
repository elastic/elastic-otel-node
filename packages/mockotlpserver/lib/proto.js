/**
 * Some utilities for working with the OpenTelemetry proto files.
 */

// const path = require('path');

const protobuf = require('protobufjs');

// TODO: for now `proto` files are copied from
// https://github.com/open-telemetry/opentelemetry-proto
// but maybe its better to have a submodule like otel-js does
// const prefix = path.resolve(__dirname, '../opentelemetry/proto/');
// const paths = [
//     '/common/v1/common.proto',
//     '/resource/v1/resource.proto',
//     '/logs/v1/logs.proto',
//     '/metrics/v1/metrics.proto',
//     '/trace/v1/trace.proto',
//     '/collector/logs/v1/logs_service.proto',
//     '/collector/metrics/v1/metrics_service.proto',
//     '/collector/trace/v1/trace_service.proto',
// ];
// let root;
// for (const p of paths) {
//     root = protobuf.loadSync(`${prefix}${p}`, root);
// }

function getProtoRoot() {
    // return root;
    // @ts-ignore
    return protobuf.Root.fromJSON(require('../opentelemetry/proto.json'));
}

module.exports = {
    getProtoRoot,
};
