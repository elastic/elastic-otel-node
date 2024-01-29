const {
    OTLPMetricExporter,
} = require('@opentelemetry/exporter-metrics-otlp-proto');
const {metrics, NodeSDK} = require('@opentelemetry/sdk-node');
const {
    envDetectorSync,
    hostDetectorSync,
    processDetectorSync,
    Resource,
} = require('@opentelemetry/resources');
const {HttpInstrumentation} = require('@opentelemetry/instrumentation-http');
const {
    ExpressInstrumentation,
} = require('@opentelemetry/instrumentation-express');
const {HostMetrics} = require('@opentelemetry/host-metrics');

const {setupLogger} = require('./logging');

const ELASTIC_SDK_VERSION = require('../package.json').version;
const USER_AGENT_PREFIX = `elastic-otel-node/${ELASTIC_SDK_VERSION}`;

/**
 * @typedef {Partial<import('@opentelemetry/sdk-node').NodeSDKConfiguration>} PartialNodeSDKConfiguration
 */

class ElasticNodeSDK extends NodeSDK {
    /**
     * @param {PartialNodeSDKConfiguration} opts
     */
    constructor(opts = {}) {
        const log = setupLogger();
        log.trace('ElasticNodeSDK opts:', opts);

        if (!('OTEL_TRACES_EXPORTER' in process.env)) {
            // Ensure this envvar is set to avoid a diag.warn() in NodeSDK.
            process.env.OTEL_TRACES_EXPORTER = 'otlp';
        }

        /** @type {NodeJS.ProcessEnv} */
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
        /** @type {PartialNodeSDKConfiguration} */
        const defaultConfig = {
            resourceDetectors: [
                // Add resource atttributes related to our distro
                {
                    detect: () => {
                        // TODO: change to semconv resource attribs when
                        // `@opentelemetry/semantic-conventions`get updated with the attribs used
                        // https://github.com/open-telemetry/opentelemetry-js/issues/4235
                        return new Resource({
                            'telemetry.distro.name': 'elastic',
                            'telemetry.distro.version': `${ELASTIC_SDK_VERSION}`,
                        });
                    },
                },
                envDetectorSync,
                processDetectorSync,
                // hostDetectorSync is not currently in the OTel default, but may be added
                hostDetectorSync,
                // TODO cloud/container detectors by default
            ],
            // TODO log exporter? Optionally. Compare to apm-agent-java opts.
            // logRecordProcessor: new logs.SimpleLogRecordProcessor(new logs.ConsoleLogRecordExporter()),
            instrumentations: [
                // TODO All the instrumentations. Perf. Config support. Custom given instrs.
                new HttpInstrumentation(),
                new ExpressInstrumentation(),
            ],
        };

        // Default metrics exporter.
        // Currently NodeSDK does not handle `OTEL_METRICS_EXPORTER`
        // https://opentelemetry.io/docs/concepts/sdk-configuration/general-sdk-configuration/#otel_metrics_exporter
        // For now we configure periodic (30s) export via OTLP/proto.
        // TODO metrics exporter should do for metrics what `TracerProviderWithEnvExporters` does for traces, does that include `url` export endpoint?
        // TODO what `temporalityPreference`?
        // TODO make the Millis values configurable. What would otel java do?
        // TODO config to disable metrics? E.g. otherwise `http.server.duration` will send every period forever and data can be distracting
        const metricsDisabled = process.env.ETEL_METRICS_DISABLED === 'true'; // TODO hack for now
        if (!metricsDisabled) {
            const metricsInterval =
                Number(process.env.ETEL_METRICS_INTERVAL_MS) || 30000;
            defaultConfig.metricReader =
                new metrics.PeriodicExportingMetricReader({
                    // exporter: new metrics.ConsoleMetricExporter(),
                    exporter: new OTLPMetricExporter(),
                    exportIntervalMillis: metricsInterval,
                    exportTimeoutMillis: metricsInterval, // TODO same val appropriate for timeout?
                });
        }

        const configuration = Object.assign(defaultConfig, opts);
        super(configuration);

        Object.keys(envToRestore).forEach((k) => {
            process.env[k] = envToRestore[k];
        });

        this._metricsDisabled = metricsDisabled;
        this._log = log;
    }

    start() {
        // TODO: make this preamble useful, or drop it
        this._log.info(
            {premable: true},
            'starting Elastic OpenTelemetry Node.js SDK distro'
        );
        super.start();

        // Once the SDK is started the exporters are available/resolved so
        // we can acces them and add/modify headers to set pur distro data
        // TODO: should we keep it even if the user passed a custom exporter?
        const unknownUserAgent = 'OTel-Unknown-Exporter-JavaScript';
        // @ts-expect-error -- accessing a private property of the SDK
        for (const exporter of this._tracerProvider._configuredExporters) {
            const headers = exporter.headers;
            const userAgent = headers['User-Agent'] || unknownUserAgent;
            headers['User-Agent'] = `${USER_AGENT_PREFIX} ${userAgent}`;
        }

        if (!this._metricsDisabled) {
            // TODO: make this configurable, user might collect host metrics with a separate utility
            this._hostMetrics = new HostMetrics({
                name: '', // Use empty string to satisfy types, but get default.
            });
            this._hostMetrics.start();
        }
    }
}

module.exports = {
    ElasticNodeSDK,
};
