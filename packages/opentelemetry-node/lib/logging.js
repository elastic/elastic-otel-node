/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
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

// As a hack for occasional unergonomic diag logging from upstream OTel JS, we
// sometimes filter out specific log messages. This should be used sparingly,
// and each case should ideally have an upstream issue to remove it or downgrade
// the log level.
const FILTER_OUT_DIAG_ERROR_MESSAGES = [
    // https://github.com/open-telemetry/opentelemetry-js/pull/5546, @opentelemetry/resources@2.0.1
    'Accessing resource attributes before async attributes settled',
];
const FILTER_OUT_DIAG_WARN_MESSAGES = [
    // https://github.com/open-telemetry/opentelemetry-js-contrib/pull/2767
    'No meter provider, using default',
];

/**
 * Return an OTel log level to use, based on the OTEL_LOG_LEVEL envvar.
 * This is normalized to upper-case, and defaults to INFO if the value is
 * not set or unrecognized.
 */
function otelLogLevelFromEnv() {
    // TODO: should this use the new diagLogLevelFromString?
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
            error: (msg, ...args) => {
                if (FILTER_OUT_DIAG_ERROR_MESSAGES.includes(msg)) {
                    return;
                }
                log.error(msg, ...args);
            },
            warn: (msg, ...args) => {
                if (FILTER_OUT_DIAG_WARN_MESSAGES.includes(msg)) {
                    return;
                }
                log.warn(msg, ...args);
            },
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
