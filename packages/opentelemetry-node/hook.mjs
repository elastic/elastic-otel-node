/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO: Can/should we use @opentelemetry/instrumentation/hook.mjs instead?
import {
    initialize,
    resolve,
    load,
} from 'import-in-the-middle/hook.mjs';
export {initialize, resolve, load};
