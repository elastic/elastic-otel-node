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

// Register ESM hook and start the SDK.
// This is called for `--import @elastic/opentelemetry-node`.

import {register} from 'node:module';
import {isMainThread} from 'node:worker_threads';

// TODO log.trace relevant handling in here

/**
 * Return true iff it looks like the `@elastic/opentelemetry-node/hook.mjs`
 * was loaded via node's `--experimental-loader` option.
 *
 * Dev Note: keep this in sync with "import.mjs".
 */
function haveHookFromExperimentalLoader() {
    const USED_LOADER_OPT =
        /--(experimental-)?loader(\s+|=)@elastic\/opentelemetry-node\/hook.mjs/;
    for (let i = 0; i < process.execArgv.length; i++) {
        const arg = process.execArgv[i];
        const nextArg = process.execArgv[i + 1];
        if (
            (arg === '--loader' || arg === '--experimental-loader') &&
            nextArg === '@elastic/opentelemetry-node/hook.mjs'
        ) {
            return true;
        } else if (USED_LOADER_OPT.test(arg)) {
            return true;
        }
    }
    if (process.env.NODE_OPTIONS && USED_LOADER_OPT.test(process.env.NODE_OPTIONS)) {
        return true;
    }
    return false;
}

if (isMainThread) {
    if (typeof register === 'function' && !haveHookFromExperimentalLoader()) {
        register('./hook.mjs', import.meta.url);
    }

    await import('./lib/start.js');
}
