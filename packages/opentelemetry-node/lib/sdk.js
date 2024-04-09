/**
 * @typedef {import('@opentelemetry/sdk-node').NodeSDKConfiguration} NodeSDKConfiguration
 */

const {
    OTLPMetricExporter,
} = require('@opentelemetry/exporter-metrics-otlp-proto');
const {OTLPLogExporter} = require('@opentelemetry/exporter-logs-otlp-proto');
const {metrics, NodeSDK} = require('@opentelemetry/sdk-node');
const {
    envDetectorSync,
    hostDetectorSync,
    processDetectorSync,
} = require('@opentelemetry/resources');
const {BatchLogRecordProcessor} = require('@opentelemetry/sdk-logs');

const {setupLogger} = require('./logging');
const {distroDetectorSync} = require('./detector');
const {setupEnvironment, restoreEnvironment} = require('./environment');
const {getInstrumentations} = require('./instrumentations');
const {enableHostMetrics, HOST_METRICS_VIEWS} = require('./metrics/host');

class ElasticNodeSDK extends NodeSDK {
    /**
     * @param {Partial<NodeSDKConfiguration>} opts
     */
    constructor(opts = {}) {
        const log = setupLogger();
        log.trace('ElasticNodeSDK opts:', opts);

        // Setup & fix some env
        setupEnvironment();
        // TODO detect service name

        // - NodeSDK defaults to `TracerProviderWithEnvExporters` if neither
        //   `spanProcessor` nor `traceExporter` are passed in.
        /** @type {Partial<NodeSDKConfiguration>} */
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
        };

        // Use user's instrumetations or get the default ones
        defaultConfig.instrumentations =
            opts.instrumentations || getInstrumentations();

        // Default logs exporter.
        // TODO: handle other protocols per OTEL_ exporter envvars (or get core NodeSDK to do it). Currently hardcoding to http/proto
        defaultConfig.logRecordProcessor = new BatchLogRecordProcessor(
            new OTLPLogExporter()
        );

        // Default metrics exporter.
        // Currently NodeSDK does not handle `OTEL_METRICS_EXPORTER`
        // https://opentelemetry.io/docs/concepts/sdk-configuration/general-sdk-configuration/#otel_metrics_exporter
        // For now we configure periodic (30s) export via OTLP/proto.
        // TODO metrics exporter should do for metrics what `TracerProviderWithEnvExporters` does for traces, does that include `url` export endpoint?
        // TODO what `temporalityPreference`?
        // TODO make the Millis values configurable. What would otel java do?
        // References about metrics config
        // - java: https://github.com/open-telemetry/opentelemetry-java/tree/main/sdk-extensions/autoconfigure
        //   has no references to timeouts or intervals
        // - net: https://opentelemetry.io/docs/languages/net/automatic/config/
        //   defines OTEL_METRIC_EXPORT_INTERVAL and OTEL_METRIC_EXPORT_TIMEOUT

        // Disble metrics by config
        // E.g. otherwise `http.server.duration` will send every period forever and data can be distracting
        // - In this 1st pass we have a config to disable all
        // - In a 2nd pass we could add another config to filter the metrics being sent and provide a default
        //   filter. A list of coma separated patterns would be okay to use it in env and also a config file
        const metricsDisabled =
            process.env.ELASTIC_OTEL_METRICS_DISABLED === 'true';
        if (!metricsDisabled) {
            const metricsInterval =
                Number(process.env.ETEL_METRICS_INTERVAL_MS) || 30000;
            defaultConfig.metricReader =
                new metrics.PeriodicExportingMetricReader({
                    exporter: new OTLPMetricExporter(),
                    exportIntervalMillis: metricsInterval,
                    exportTimeoutMillis: metricsInterval, // TODO same val appropriate for timeout?
                });
            defaultConfig.views = [
                // Add views for `host-metrics` to avoid excess of data being sent to the server
                ...HOST_METRICS_VIEWS,
            ];
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
            {preamble: true},
            'starting Elastic OpenTelemetry Node.js SDK distro'
        );
        super.start();

        if (!this._metricsDisabled) {
            // TODO: make this configurable, user might collect host metrics with a separate utility
            enableHostMetrics();
        }
    }
}

module.exports = {
    ElasticNodeSDK,
};
