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

// TODO: Update @opentelemetry/instrumentation exports to use it rather than IITM directly, if can.
import {createAddHookMessageChannel} from 'import-in-the-middle';

import {log} from './lib/logging.js';

if (isMainThread) {
    // Note: If there are *multiple* installations of import-in-the-middle, then
    // only those instrumentations using this same one will be hooked.
    const {registerOptions, waitForAllMessagesAcknowledged} =
        createAddHookMessageChannel();

    log.trace('import.mjs: registering module hook');
    register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions);

    await import('./lib/start.js');

    // Ensure that the loader has acknowledged all the modules before we allow
    // execution to continue.
    await waitForAllMessagesAcknowledged();
} else {
    log.trace('import.mjs: skipping EDOT Node.js bootstrap on non-main thread');
}
