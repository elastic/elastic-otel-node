/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An example of a *minimal*, *CommonJS* EDOT Node.js bootstrap script.
 * - It uses CommonJS, so is appropriate to use with `node --require ...`.
 * - It does not setup a module loader hook for ES Modules, so instrumentation
 *   of packages loaded from ESM code will not work.
 *
 * Usage:
 *  node --require ./telemetry-cjs.js app.js
 */

const {startNodeSDK} = require('../../lib/sdk.js'); // @elastic/opentelemetry-node/sdk
startNodeSDK();
