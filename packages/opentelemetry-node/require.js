/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Start the SDK for CommonJS usage.
// This is called for `--require @elastic/opentelemetry-node`.
//
// Note: This does *not* register an import hook for ESM instrumentation. Use
// `--import @elastic/opentelemetry-node` for that.

const {isMainThread} = require('worker_threads');

const {startNodeSDK} = require('./lib/sdk.js');

if (isMainThread) {
    startNodeSDK();
} else {
    const {log} = require('./lib/logging');
    log.trace(
        'require.mjs: skipping EDOT Node.js bootstrap on non-main thread'
    );
}
