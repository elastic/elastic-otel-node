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
