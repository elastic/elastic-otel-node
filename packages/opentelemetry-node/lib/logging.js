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

// This provides a `log` singleton Logger instance to be used for logging
// by this SDK.
//
// Dev Note: This file is loaded very early in bootstrapping the SDK, typically
// before ESM hooks are registered. To keep that code path simple, this file
// should keep deps to a minimum.

const luggite = require('./luggite');

const _globalThis = typeof globalThis === 'object' ? globalThis : global;
const _symLog = Symbol.for('elastic-otel-node.log');

// Dev Note: `OTEL_LOG_LEVEL`s are not standardized.
// https://github.com/open-telemetry/opentelemetry-specification/issues/920
// https://github.com/open-telemetry/opentelemetry-specification/issues/2039
const DEFAULT_OTEL_LOG_LEVEL = 'INFO';
const LUGGITE_LEVEL_FROM_OTEL_LOG_LEVEL = {
    NONE: luggite.FATAL + 1, // TODO: support 'silent' luggite level
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
    VERBOSE: 'trace',
    ALL: 'trace',
};

/**
 * Return an OTel log level to use, based on the OTEL_LOG_LEVEL envvar.
 * This is normalized to upper-case, and defaults to INFO if the value is
 * not set or unrecognized.
 */
function otelLogLevelFromEnv() {
    let otelLogLevel;
    if (process.env.OTEL_LOG_LEVEL) {
        otelLogLevel = process.env.OTEL_LOG_LEVEL.toUpperCase();
        if (LUGGITE_LEVEL_FROM_OTEL_LOG_LEVEL[otelLogLevel] === undefined) {
            otelLogLevel = null;
        }
    }
    if (!otelLogLevel) {
        otelLogLevel = DEFAULT_OTEL_LOG_LEVEL;
    }
    return otelLogLevel;
}

/**
 * Create a logger using the level from OTEL_LOG_LEVEL, default 'info'.
 */
function createLogger() {
    const level =
        LUGGITE_LEVEL_FROM_OTEL_LOG_LEVEL[otelLogLevelFromEnv()] || null;
    return luggite.createLogger({name: 'elastic-otel-node', level});
}

/**
 * Register the singleton `log` to handle OTel `api.diag.*()` calls.
 */
function registerOTelDiagLogger(api) {
    // TODO: when luggite supports .child, add a module/component attr for diag log output
    const diagLevel = otelLogLevelFromEnv();
    api.diag.setLogger(
        {
            error: log.error.bind(log),
            warn: log.warn.bind(log),
            info: log.info.bind(log),
            debug: log.debug.bind(log),
            verbose: log.trace.bind(log),
        },
        api.DiagLogLevel[diagLevel]
    );
}

// ---- main line

// Create, if necessary, and export a singleton `log` logger instance.
if (_globalThis[_symLog] === undefined) {
    _globalThis[_symLog] = createLogger();
}
/** @type {import('./luggite').Logger} */
const log = _globalThis[_symLog];

// ---- exports

module.exports = {
    log,
    registerOTelDiagLogger,
};
