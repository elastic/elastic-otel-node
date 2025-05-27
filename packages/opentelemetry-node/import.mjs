/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Register ESM hook and start the SDK.
// This is called for `--import @elastic/opentelemetry-node`.

import {register} from 'node:module';
import {isMainThread} from 'node:worker_threads';

import {startNodeSDK, createAddHookMessageChannel} from './lib/sdk.js';
import {log} from './lib/logging.js';

if (isMainThread) {
    // Note: If there are *multiple* installations of import-in-the-middle, then
    // only those instrumentations using this same one will be hooked.
    const {registerOptions, waitForAllMessagesAcknowledged} =
        createAddHookMessageChannel();

    log.trace('import.mjs: registering module hook');
    register('./hook.mjs', import.meta.url, registerOptions);

    startNodeSDK();

    // Ensure that the loader has acknowledged all the modules before we allow
    // execution to continue.
    await waitForAllMessagesAcknowledged();
} else {
    log.trace('import.mjs: skipping EDOT Node.js bootstrap on non-main thread');
}
