const {NodeSDK, api} = require('@opentelemetry/sdk-node');
const {
    envDetectorSync,
    hostDetectorSync,
    processDetectorSync,
} = require('@opentelemetry/resources');
const {HttpInstrumentation} = require('@opentelemetry/instrumentation-http');

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
 * @param {Partial<import('@opentelemetry/sdk-node').NodeSDKConfiguration>} opts
 */
class ElasticNodeSDK extends NodeSDK {
    constructor(opts = {}) {
        const log = createLogger();
        log.trace('ElasticNodeSDK opts:', opts);

        if (!('OTEL_TRACES_EXPORTER' in process.env)) {
            // Ensure this envvar is set to avoid a diag.warn() in NodeSDK.
            process.env.OTEL_TRACES_EXPORTER = 'otlp';
        }

        // TODO accept serviceName, detect service name

        // - NodeSDK defaults to `TracerProviderWithEnvExporters` if neither
        //   `spanProcessor` nor `traceExporter` are passed in.
        const defaultConfig = {
            resourceDetectors: [
                envDetectorSync,
                processDetectorSync,
                // hostDetectorSync is not currently in the OTel default, but may be added
                hostDetectorSync,
                // TODO cloud/container detectors by default
            ],
            // TODO metrics
            // TODO log exporter? Optionally. Compare to apm-agent-java opts.
            // logRecordProcessor: new logs.SimpleLogRecordProcessor(new logs.ConsoleLogRecordExporter()),
            instrumentations: [
                // TODO All the instrumentations. Perf. Config support. Custom given instrs.
                new HttpInstrumentation(),
            ],
        };

        const configuration = Object.assign(defaultConfig, opts);
        super(configuration);

        this._log = log;
    }

    start() {
        // TODO: make this preable useful, or drop it
        this._log.info(
            {premable: true},
            'starting Elastic OpenTelemetry Node.js SDK distro'
        );
        super.start();
    }
}

/**
 * Create a logger the level from OTEL_LOG_LEVEL, default 'info'.
 * Also set this logger to handle `api.diag.*()` log methods.
 */
function createLogger() {
    let level;
    let diagLevel;
    if (process.env.OTEL_LOG_LEVEL) {
        const otelLogLevel = process.env.OTEL_LOG_LEVEL.toUpperCase();
        level = luggiteLevelFromOtelLogLevel(otelLogLevel);
        diagLevel = otelLogLevel;
        // Make sure NodeSDK doesn't see this envvar and overwrite our diag logger.
        delete process.env.OTEL_LOG_LEVEL;
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
    ElasticNodeSDK,
};
