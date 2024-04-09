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

const {api} = require('@opentelemetry/sdk-node');

const luggite = require('./luggite');

/**
 * This is passed the user-provided value of `OTEL_LOG_LEVEL`. It should return
 * null if the value is unrecognized.
 *
 * Dev Note: `OTEL_LOG_LEVEL`s are not standardized.
 * https://github.com/open-telemetry/opentelemetry-specification/issues/920
 * https://github.com/open-telemetry/opentelemetry-specification/issues/2039
 */
function luggiteLevelFromOtelLogLevel(otelLogLevel) {
    const luggiteLevel =
        {
            NONE: luggite.FATAL + 1, // TODO: support 'silent' luggite level
            ERROR: 'error',
            WARN: 'warn',
            INFO: 'info',
            DEBUG: 'debug',
            VERBOSE: 'trace',
            ALL: 'trace',
        }[otelLogLevel] || null;
    return luggiteLevel;
}

/**
 * Create a logger using the level from OTEL_LOG_LEVEL, default 'info'.
 * Also set this logger to handle `api.diag.*()` log methods.
 */
function setupLogger() {
    let level;
    let diagLevel;
    if (process.env.OTEL_LOG_LEVEL) {
        const otelLogLevel = process.env.OTEL_LOG_LEVEL.toUpperCase();
        level = luggiteLevelFromOtelLogLevel(otelLogLevel);
        diagLevel = otelLogLevel;
    }
    if (!level) {
        level = 'info'; // default level
        diagLevel = 'INFO';
    }

    const log = luggite.createLogger({name: 'elastic-otel-node', level});
    // TODO: when luggite supports .child, add a module/component attr for diag log output
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

    return log;
}

module.exports = {
    setupLogger,
};
