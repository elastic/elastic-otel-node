/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Some utilities for working with the OpenTelemetry proto files.
 */

const {resolve} = require('path');

const {Root} = require('protobufjs');

// Protobuf definitions are kept in sync with the ones in the upstream
// repository by using a script.
//
// To update go to the root folder and run:
//  node ./scripts/update-protos.js
const prefix = resolve(__dirname, '..');
const paths = [
    '/opentelemetry/proto/collector/logs/v1/logs_service.proto',
    '/opentelemetry/proto/collector/metrics/v1/metrics_service.proto',
    '/opentelemetry/proto/collector/trace/v1/trace_service.proto',
];

// Create a new Root so we can patch it
const root = new Root();

// This function is patched because the Root class does not have any
// referece of which is the root path of the proto files. Instead it
// takes the folder of current file being processed as the root path
// resulting in duplicated subpaths
//
// Example: resource.proto file importing common.proto results in
// /Users/.../mockotlpserver/opentelemetry/proto/resource/v1/opentelemetry/proto/common/v1/common.proto
//
// Ref: https://github.com/protobufjs/protobuf.js/issues/1971
root.resolvePath = function patchResolvePath(filename) {
    let path = Root.prototype.resolvePath.apply(root, arguments);
    if (filename) {
        const folder = resolve(filename, '..');
        path = prefix + path.replace(folder, '');
    }
    return path;
};

// Load the files at once
root.loadSync(paths.map((p) => `${prefix}${p}`));

/**
 * Return `any` for now otherwise we get type errors when using
 * `root.lookupType(...)` in `normalize.js
 * @returns {any}
 */
function getProtoRoot() {
    return root;
}

module.exports = {
    getProtoRoot,
};
