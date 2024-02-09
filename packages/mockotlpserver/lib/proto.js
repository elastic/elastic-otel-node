/**
 * Some utilities for working with the OpenTelemetry proto files.
 */

const path = require('path');

const {Root} = require('protobufjs');

// TODO: for now `proto` files are copied from
// https://github.com/open-telemetry/opentelemetry-proto/releases/tag/v1.0.0
// but maybe its better to have a submodule like otel-js does
const prefix = path.resolve(__dirname, '..');
const paths = [
    '/opentelemetry/proto/common/v1/common.proto',
    '/opentelemetry/proto/resource/v1/resource.proto',
    '/opentelemetry/proto/logs/v1/logs.proto',
    '/opentelemetry/proto/metrics/v1/metrics.proto',
    '/opentelemetry/proto/trace/v1/trace.proto',
    '/opentelemetry/proto/collector/logs/v1/logs_service.proto',
    '/opentelemetry/proto/collector/metrics/v1/metrics_service.proto',
    '/opentelemetry/proto/collector/trace/v1/trace_service.proto',
];

// Craete a new Root so we can patch it
const root = new Root();

// This function is patched because the Root class does not have any
// referece of which is the root path of the proto files. Instead it
// takes the folder of current file being processed as the root path
// resulting in duplicated subpaths
// Example: resource.proto file importing common.proto results in
// /Users/.../mockotlpserver/opentelemetry/proto/resource/v1/opentelemetry/proto/common/v1/common.proto
root.resolvePath = function patchResolvePath(filename) {
    let path = Root.prototype.resolvePath.apply(root, arguments);
    if (filename) {
        const folder = filename.split('/').slice(0, -1).join('/');
        path = prefix + path.replace(folder, '');
    }
    return path;
};

// Load the files at once
root.loadSync(paths.map((p) => `${prefix}${p}`));

/**
 * Return `any` for now itherwise we get type errors when using
 * `root.lookupType(...)` in `normalize.js
 * @returns {any}
 */
function getProtoRoot() {
    return root;
}

module.exports = {
    getProtoRoot,
};
