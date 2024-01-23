const {NodeSDK} = require('@opentelemetry/sdk-node');
const {
    envDetectorSync,
    hostDetectorSync,
    processDetectorSync,
} = require('@opentelemetry/resources');
const {HttpInstrumentation} = require('@opentelemetry/instrumentation-http');

const {setupLogger} = require('./logging');

/**
 * @param {Partial<import('@opentelemetry/sdk-node').NodeSDKConfiguration>} opts
 */
class ElasticNodeSDK extends NodeSDK {
    constructor(opts = {}) {
        const log = setupLogger();
        log.trace('ElasticNodeSDK opts:', opts);

        if (!('OTEL_TRACES_EXPORTER' in process.env)) {
            // Ensure this envvar is set to avoid a diag.warn() in NodeSDK.
            process.env.OTEL_TRACES_EXPORTER = 'otlp';
        }
        const envToRestore = {};
        if ('OTEL_LOG_LEVEL' in process.env) {
            envToRestore['OTEL_LOG_LEVEL'] = process.env.OTEL_LOG_LEVEL;
            // Make sure NodeSDK doesn't see this envvar and overwrite our diag
            // logger. It is restored below.
            delete process.env.OTEL_LOG_LEVEL;
        }

        // TODO detect service name

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

        Object.keys(envToRestore).forEach((k) => {
            process.env[k] = envToRestore[k];
        });

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

module.exports = {
    ElasticNodeSDK,
};
