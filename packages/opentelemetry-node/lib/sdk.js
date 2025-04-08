/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// This is the '@elastic/opentelemetry-node/sdk' entry-point.

const os = require('os');

const {
    getBooleanFromEnv,
    getNumberFromEnv,
    getStringFromEnv,
} = require('@opentelemetry/core');
const {
    api,
    core,
    logs,
    metrics,
    node,
    resources,
    tracing,
    NodeSDK,
} = require('@opentelemetry/sdk-node');
const {BatchLogRecordProcessor} = require('@opentelemetry/sdk-logs');
const {createAddHookMessageChannel} = require('import-in-the-middle');

const {log, registerOTelDiagLogger} = require('./logging');
const luggite = require('./luggite');
const {resolveDetectors} = require('./detectors');
const {setupEnvironment, restoreEnvironment} = require('./environment');
const {getInstrumentations} = require('./instrumentations');
const {enableHostMetrics, HOST_METRICS_VIEWS} = require('./metrics/host');
const DISTRO_VERSION = require('../package.json').version;

/**
 * @typedef {import('@opentelemetry/sdk-node').NodeSDKConfiguration} NodeSDKConfiguration
 */

/**
 * @typedef {Object} ElasticNodeSDKOptions
 * @property {boolean} setupShutdownHandlers - Whether to setup handlers on
 *      `process` events to shutdown the SDK. Default true.
 */

function setupShutdownHandlers(sdk) {
    // TODO avoid possible double sdk.shutdown(). I think that results in unnecessary work.
    process.on('SIGTERM', async () => {
        try {
            await sdk.shutdown();
        } catch (err) {
            console.warn('warning: error shutting down OTel SDK', err);
        }
        process.exit(128 + os.constants.signals.SIGTERM);
    });

    process.once('beforeExit', async () => {
        // Flush recent telemetry data if about the shutdown.
        try {
            await sdk.shutdown();
        } catch (err) {
            console.warn('warning: error shutting down OTel SDK', err);
        }
    });
}

/**
 * Create and start an OpenTelemetry NodeSDK.
 *
 * While this returns an object with `shutdown()` method, the default behavior
 * is to setup `process.on(...)` handlers to handle shutdown. See the
 * `setupShutdownHandlers` boolean option.
 *
 * @param {Partial<NodeSDKConfiguration & ElasticNodeSDKOptions>} cfg
 * @returns {{ shutdown(): Promise<void>; }}
 */
function startNodeSDK(cfg = {}) {
    log.trace('startNodeSDK cfg:', cfg);

    // TODO: test behaviour with OTEL_SDK_DISABLED.
    //      Do we still log preamble? See NodeSDK _disabled handling.
    //      Do we still attempt to enableHostMetrics()?
    if (getBooleanFromEnv('OTEL_SDK_DISABLED')) {
        // Note: This differs slightly from current NodeSDK, which does *some*
        // processing, even if disabled.
        log.trace('startNodeSDK: disabled');
        return {
            shutdown() {
                return Promise.resolve();
            },
        };
    }

    registerOTelDiagLogger(api);

    /** @type {Partial<NodeSDKConfiguration>} */
    const defaultConfig = {
        resourceDetectors: resolveDetectors(cfg.resourceDetectors),
        instrumentations: cfg.instrumentations || getInstrumentations(),
        // Avoid setting `spanProcessor` or `traceExporter` to have NodeSDK
        // use its `TracerProviderWithEnvExporters` for tracing setup.
    };

    const exporterPkgNameFromEnvVar = {
        grpc: 'grpc',
        'http/json': 'http',
        'http/protobuf': 'proto', // default
    };

    // Logs config.
    const logsExportProtocol =
        getStringFromEnv('OTEL_EXPORTER_OTLP_LOGS_PROTOCOL') ||
        getStringFromEnv('OTEL_EXPORTER_OTLP_PROTOCOL') ||
        'http/protobuf';
    let logExporterType = exporterPkgNameFromEnvVar[logsExportProtocol];
    if (!logExporterType) {
        log.warn(
            `Logs exporter protocol "${logsExportProtocol}" unknown. Using default "http/protobuf" protocol`
        );
        logExporterType = 'proto';
    }
    log.trace(`Logs exporter protocol set to ${logsExportProtocol}`);
    const {OTLPLogExporter} = require(
        `@opentelemetry/exporter-logs-otlp-${logExporterType}`
    );
    defaultConfig.logRecordProcessors = [
        new BatchLogRecordProcessor(new OTLPLogExporter()),
    ];

    // Metrics config.
    // TODO: support `OTEL_METRICS_EXPORTER`, including being a list of exporters (e.g. console, debug)
    // TODO: metrics exporter should do for metrics what `TracerProviderWithEnvExporters` does for traces, does that include `url` export endpoint?

    const temporalityPreference = getStringFromEnv(
        'OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE'
    );
    if (typeof temporalityPreference === 'undefined') {
        // Setting default temporality to delta to avoid histogram storing issues in ES
        // Ref: https://github.com/elastic/opentelemetry/pull/63
        process.env.OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE = 'delta';
    }

    // TODO: How does this differ from `OTEL_METRICS_EXPORTER=none` in sdk-node?
    const metricsDisabled =
        getBooleanFromEnv('ELASTIC_OTEL_METRICS_DISABLED') ?? false;
    if (!metricsDisabled) {
        const metricsExportProtocol =
            getStringFromEnv('OTEL_EXPORTER_OTLP_METRICS_PROTOCOL') ||
            getStringFromEnv('OTEL_EXPORTER_OTLP_PROTOCOL') ||
            'http/protobuf';
        let metricExporterType =
            exporterPkgNameFromEnvVar[metricsExportProtocol];
        if (!metricExporterType) {
            log.warn(
                `Metrics exporter protocol "${metricsExportProtocol}" unknown. Using default "http/protobuf" protocol`
            );
            metricExporterType = 'proto';
        }
        log.trace(`Metrics exporter protocol set to ${metricsExportProtocol}`);
        const {OTLPMetricExporter} = require(
            `@opentelemetry/exporter-metrics-otlp-${metricExporterType}`
        );

        // https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#periodic-exporting-metricreader
        const metricsInterval =
            getNumberFromEnv('OTEL_METRIC_EXPORT_INTERVAL') ?? 60000;
        const metricsTimeout =
            getNumberFromEnv('OTEL_METRIC_EXPORT_TIMEOUT') ?? 30000;

        defaultConfig.metricReader = new metrics.PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter(),
            exportIntervalMillis: metricsInterval,
            exportTimeoutMillis: metricsTimeout,
        });
        defaultConfig.views = [
            // Add views for `host-metrics` to avoid excess of data being sent
            // to the server.
            ...HOST_METRICS_VIEWS,
        ];
    }

    const config = Object.assign(defaultConfig, cfg);

    setupEnvironment();
    const sdk = new NodeSDK(config);

    if (config.setupShutdownHandlers ?? true) {
        setupShutdownHandlers(sdk);
    }

    log.info(
        {
            preamble: true,
            distroVersion: DISTRO_VERSION,
            env: {
                // For darwin: https://en.wikipedia.org/wiki/Darwin_%28operating_system%29#Release_history
                os: `${os.platform()} ${os.release()}`,
                arch: os.arch(),
                runtime: `Node.js ${process.version}`,
            },
            // The "config" object structure is not stable.
            config: {
                logLevel: luggite.nameFromLevel[log.level()] ?? log.level(),
            },
        },
        'start EDOT Node.js'
    );
    sdk.start(); // .start() *does* use `process.env` though I think it should not.
    restoreEnvironment();

    if (!metricsDisabled) {
        // TODO: make this configurable, user might collect host metrics with a separate utility. Perhaps use 'host-metrics' in DISABLED_INSTRs existing env var.
        enableHostMetrics();
    }

    // Return an object that is a subset of the upstream NodeSDK interface,
    // just enough to shutdown.
    return {
        shutdown() {
            return sdk.shutdown();
        },
    };
}

module.exports = {
    getInstrumentations,
    startNodeSDK,

    createAddHookMessageChannel, // re-export from import-in-the-middle

    // Re-exports from sdk-node, so that users bootstrapping EDOT Node.js in
    // code can access useful parts of the SDK.
    // One difference the re-exports in `@opentelmetry/sdk-node`, is that we
    // are not re-exporting `contextBase`. It is a dupe of `api` and feels
    // vestigial.
    api,
    core,
    logs,
    metrics,
    node,
    resources,
    tracing,
};
