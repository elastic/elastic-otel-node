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
// This is called for `--require @elastic/opentelemetry-node`.

const register = require('module').register;
const {pathToFileURL} = require('url');
const {isMainThread} = require('worker_threads');

function haveHookFromExperimentalLoader() {
    const PATTERN =
        /--(experimental-)?loader\s*=?\s*@elastic\/opentelemetry-node\/hook.mjs/;
    for (let i = 0; i < process.execArgv.length; i++) {
        const arg = process.execArgv[i];
        const nextArg = process.execArgv[i + 1];
        if (
            (arg === '--loader' || arg === '--experimental-loader') &&
            nextArg === '@elastic/opentelemetry-node/hook.mjs'
        ) {
            // process._rawDebug('XXX yup: [%s, %s]', arg, nextArg);
            return true;
        } else if (PATTERN.test(arg)) {
            // process._rawDebug('XXX yup: [%s]', arg);
            return true;
        }
    }
    if (process.env.NODE_OPTIONS && PATTERN.test(process.env.NODE_OPTIONS)) {
        // process._rawDebug('XXX yup: NODE_OPTIONS');
        return true;
    }
    return false;
}

if (isMainThread) {
    // XXX logging

    if (typeof register === 'function' && !haveHookFromExperimentalLoader()) {
        process._rawDebug('XXX require.js: module.register ESM hook');
        register('./hook.mjs', pathToFileURL(__filename).toString());
    }

    require('./lib/start.js');
}
