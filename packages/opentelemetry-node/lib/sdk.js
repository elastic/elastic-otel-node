const {
    OTLPMetricExporter,
} = require('@opentelemetry/exporter-metrics-otlp-proto');
const {metrics, NodeSDK} = require('@opentelemetry/sdk-node');
const {
    envDetectorSync,
    hostDetectorSync,
    processDetectorSync,
} = require('@opentelemetry/resources');
const {HttpInstrumentation} = require('@opentelemetry/instrumentation-http');
const {
    ExpressInstrumentation,
} = require('@opentelemetry/instrumentation-express');
const {HostMetrics} = require('@opentelemetry/host-metrics');

const {setupLogger} = require('./logging');
const {distroDetectorSync} = require('./detector');
const {setupEnvironment, restoreEnvironment} = require('./environment');

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

        // Setup & fix some env
        setupEnvironment();
        // TODO detect service name

        // - NodeSDK defaults to `TracerProviderWithEnvExporters` if neither
        //   `spanProcessor` nor `traceExporter` are passed in.
        /** @type {PartialNodeSDKConfiguration} */
        const defaultConfig = {
            resourceDetectors: [
                // Elastic's own detector to add some metadata
                distroDetectorSync,
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

        // Once NodeSDK's constructor finish we can restore env
        restoreEnvironment();

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
