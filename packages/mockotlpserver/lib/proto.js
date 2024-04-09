/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
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
