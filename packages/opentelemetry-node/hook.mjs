/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO: Can/should we use @opentelemetry/instrumentation/hook.mjs instead?
import {
    initialize,
    load,
    resolve,
    getFormat,
    getSource,
} from 'import-in-the-middle/hook.mjs';
export {initialize, load, resolve, getFormat, getSource};
