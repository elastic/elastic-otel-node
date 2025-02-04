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

// Start the SDK for CommonJS usage.
// This is called for `--require @elastic/opentelemetry-node`.
//
// Note: This does *not* register an import hook for ESM instrumentation. Use
// `--import @elastic/opentelemetry-node` for that.

const {isMainThread} = require('worker_threads');

if (isMainThread) {
    require('./lib/start.js');
} else {
    const {log} = require('./lib/logging');
    log.trace(
        'require.mjs: skipping EDOT Node.js bootstrap on non-main thread'
    );
}
