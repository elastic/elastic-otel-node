/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// This is the '@elastic/opentelemetry-node/sdk' entry-point.

const os = require('os');

const {
    getBooleanFromEnv,
    getStringFromEnv,
    getStringListFromEnv,
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
const {AggregationType} = require('@opentelemetry/sdk-metrics');
const {HostMetrics} = require('@opentelemetry/host-metrics');

const {createAddHookMessageChannel} = require('import-in-the-middle');

const {log, registerOTelDiagLogger} = require('./logging');
const luggite = require('./luggite');
const {resolveDetectors} = require('./detectors');
const {setupEnvironment, restoreEnvironment} = require('./environment');
const {getInstrumentations} = require('./instrumentations');
const DISTRO_VERSION = require('../package.json').version;

/**
 * @typedef {import('@opentelemetry/sdk-node').NodeSDKConfiguration} NodeSDKConfiguration
 */

/**
 * @typedef {Object} ElasticNodeSDKOptions
 * @property {boolean} elasticSetupShutdownHandlers - Whether to setup handlers
 *      on `process` events to shutdown the SDK. Default true.
 *
 * Note: To avoid collisions with NodeSDKConfiguration properties, all/most
 * properities of this type should be prefixed with "elastic".
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

    // Setting default temporality to delta to avoid histogram storing issues in ES.
    // Or log if there is a different value set by the user
    // Ref: https://github.com/elastic/opentelemetry/pull/63
    const temporalityPreference = getStringFromEnv(
        'OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE'
    );
    if (typeof temporalityPreference === 'undefined') {
        process.env.OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE = 'delta';
    } else if (temporalityPreference !== 'delta') {
        const docsUrl =
            'https://elastic.github.io/opentelemetry/compatibility/limitations.html#ingestion-of-metrics-data';
        log.info(
            `Metrics temporality preference set to "${temporalityPreference}". Use "delta" temporality if you want to store Histogram metrics in Elasticsearch. See ${docsUrl}`
        );
    }

    // Check the deprecated `ELASTIC_OTEL_METRICS_DISABLED` env var
    if ('ELASTIC_OTEL_METRICS_DISABLED' in process.env) {
        // log the deprecation notice
        const exporterDocs =
            'https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#exporter-selection';
        log.info(
            `Environment var "ELASTIC_OTEL_METRICS_DISABLED" is deprecated. Use "OTEL_METRICS_EXPORTER" env var to disable metrics as described in ${exporterDocs}.`
        );
        // set metrics exporter to `none` if user wants to disable
        if (getBooleanFromEnv('ELASTIC_OTEL_METRICS_DISABLED')) {
            process.env.OTEL_METRICS_EXPORTER = 'none';
        }
    }

    // If `OTEL_METRICS_EXPORTER` undefined set the default value according to spec.
    // ref: https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#exporter-selection
    // ref: https://github.com/open-telemetry/opentelemetry-js/issues/5612
    if (!process.env.OTEL_METRICS_EXPORTER?.trim()) {
        process.env.OTEL_METRICS_EXPORTER = 'otlp';
    }

    const metricsExporters = getStringListFromEnv('OTEL_METRICS_EXPORTER');
    const metricsEnabled = metricsExporters.every((e) => e !== 'none');

    if (metricsEnabled) {
        // Set the views conditionally so the upstream SDK does not create meter provider for nothing
        defaultConfig.views = [
            // Dropping system metrics because:
            // - sends a lot of data. Ref: https://github.com/elastic/elastic-otel-node/issues/51
            // - not displayed by Kibana in metrics dashboard. Ref: https://github.com/elastic/kibana/pull/199353
            // - recommendation is to use OTEL collector to get and export them
            {
                instrumentName: 'system.*',
                aggregation: {type: AggregationType.DROP},
            },
        ];
    }

    const config = Object.assign(defaultConfig, cfg);

    setupEnvironment();
    const sdk = new NodeSDK(config);

    if (config.elasticSetupShutdownHandlers ?? true) {
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

    // to enable `@opentelemetry/host-metrics`
    // - metrics should be enabled (resolved above)
    // - `ELASTIC_OTEL_HOST_METRICS_DISABLED` must not be "true"
    const hostMetricsDisabled = getBooleanFromEnv(
        'ELASTIC_OTEL_HOST_METRICS_DISABLED'
    );
    if (metricsEnabled && !hostMetricsDisabled) {
        const hostMetricsInstance = new HostMetrics();
        hostMetricsInstance.start();
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
    // code can access useful parts of the SDK.  One difference from the
    // re-exports in `@opentelmetry/sdk-node`, is that we are not re-exporting
    // `contextBase`. It is a dupe of `api` and feels vestigial.
    api,
    core,
    logs,
    metrics,
    node,
    resources,
    tracing,
};
