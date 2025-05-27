/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An example of a *minimal* EDOT Node.js bootstrap script.
 * - It does not setup a module loader hook for ES Modules, so instrumentation
 *   of packages loaded from ESM code will not work.
 *
 * Usage:
 *  node --import ./telemetry-minimal.mjs app.js
 */

import {startNodeSDK} from '@elastic/opentelemetry-node/sdk';
startNodeSDK();
