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
const {
    BatchLogRecordProcessor,
    ConsoleLogRecordExporter,
    SimpleLogRecordProcessor,
} = require('@opentelemetry/sdk-logs');
const {AggregationType} = require('@opentelemetry/sdk-metrics');
const {HostMetrics} = require('@opentelemetry/host-metrics');

const {createAddHookMessageChannel} = require('import-in-the-middle');

const {log, registerOTelDiagLogger} = require('./logging');
const luggite = require('./luggite');
const {resolveDetectors} = require('./detectors');
const {setupEnvironment, restoreEnvironment} = require('./environment');
const {getInstrumentations} = require('./instrumentations');
const {setupCentralConfig} = require('./central-config');
const {
    createDynConfSpanExporter,
    createDynConfMetricExporter,
    createDynConfLogRecordExporter,
    setupDynConfExporters,
    dynConfSpanExporters,
} = require('./dynconf');
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

function setupShutdownHandlers(shutdownFn) {
    // TODO avoid possible double sdk.shutdown(). I think that results in unnecessary work.
    process.on('SIGTERM', async () => {
        try {
            await shutdownFn();
        } catch (err) {
            console.warn('warning: error shutting down OTel SDK', err);
        }
        process.exit(128 + os.constants.signals.SIGTERM);
    });

    process.once('beforeExit', async () => {
        // Flush recent telemetry data if about the shutdown.
        try {
            await shutdownFn();
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
 * `elasticSetupShutdownHandlers` boolean option.
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

    // Check the deprecated `ELASTIC_OTEL_METRICS_DISABLED` env var
    if ('ELASTIC_OTEL_METRICS_DISABLED' in process.env) {
        const exporterDocs =
            'https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#exporter-selection';
        log.info(
            `Environment var "ELASTIC_OTEL_METRICS_DISABLED" is deprecated. Use "OTEL_METRICS_EXPORTER" env var to disable metrics as described in ${exporterDocs}.`
        );
        // set metrics exporter to `none` if user wants to disable
        // also disable `@opentelemetry/instrumentation-runtime-node`
        if (getBooleanFromEnv('ELASTIC_OTEL_METRICS_DISABLED')) {
            process.env.OTEL_METRICS_EXPORTER = 'none';
            if (process.env.OTEL_NODE_DISABLED_INSTRUMENTATIONS) {
                process.env.OTEL_NODE_DISABLED_INSTRUMENTATIONS +=
                    ',runtime-node';
            } else {
                process.env.OTEL_NODE_DISABLED_INSTRUMENTATIONS =
                    'runtime-node';
            }
        }
    }

    const instrs = cfg.instrumentations || getInstrumentations();
    /** @type {Partial<NodeSDKConfiguration>} */
    const defaultConfig = {
        resourceDetectors: resolveDetectors(cfg.resourceDetectors),
        instrumentations: instrs,
        // Avoid setting `spanProcessor` or `traceExporter` to have NodeSDK
        // use its `TracerProviderWithEnvExporters` for tracing setup.
    };

    const exporterPkgNameFromEnvVar = {
        grpc: 'grpc',
        'http/json': 'http',
        'http/protobuf': 'proto', // default
    };

    // Logs config.
    if (!('logRecordProcessors' in cfg)) {
        let logsExporterList = getStringListFromEnv('OTEL_LOGS_EXPORTER') ?? [];
        if (logsExporterList.length === 0) {
            logsExporterList.push('otlp');
        }
        const logsExporterNames = new Set(logsExporterList);
        const logProcessors = [];

        // Like for other signals the "none" value wins over the rest
        if (!logsExporterNames.has('none')) {
            for (const exporterName of logsExporterNames) {
                if (exporterName === 'console') {
                    logProcessors.push(
                        new SimpleLogRecordProcessor(new ConsoleLogRecordExporter())
                    );
                } else if (exporterName === 'otlp') {
                    const logsExportProtocol =
                        getStringFromEnv('OTEL_EXPORTER_OTLP_LOGS_PROTOCOL') ||
                        getStringFromEnv('OTEL_EXPORTER_OTLP_PROTOCOL') ||
                        'http/protobuf';
                    let logsExporterType =
                        exporterPkgNameFromEnvVar[logsExportProtocol];
                    if (!logsExporterType) {
                        log.warn(
                            `Logs exporter protocol "${logsExportProtocol}" unknown. Using default "http/protobuf" protocol`
                        );
                        logsExporterType = 'proto';
                    }
                    log.trace(
                        `Logs exporter protocol set to ${logsExportProtocol}`
                    );
                    const {OTLPLogExporter} = require(
                        `@opentelemetry/exporter-logs-otlp-${logsExporterType}`
                    );
                    logProcessors.push(
                        new BatchLogRecordProcessor(new OTLPLogExporter())
                    );
                } else {
                    log.warn(`Logs exporter "${exporterName}" unknown.`);
                }
            }
        }

        if (logProcessors.length > 0) {
            defaultConfig.logRecordProcessors = logProcessors;
        }
    }

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
            'https://www.elastic.co/docs/reference/opentelemetry/compatibility/limitations.html#ingestion-of-metrics-data';
        log.info(
            `Metrics temporality preference set to "${temporalityPreference}". Use "delta" temporality if you want to store Histogram metrics in Elasticsearch. See ${docsUrl}`
        );
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

    const config = {...defaultConfig, ...cfg};

    // Some tricks to get a handle on noop signal providers, to be used for
    // dynamic configuration.
    const tracerProviderProxy = new api.ProxyTracerProvider();
    const noopTracerProvider = tracerProviderProxy.getDelegate();
    // TODO: set our `tracerProviderProxy` as the global for `send_traces` config
    //      const success = api.trace.setGlobalTracerProvider(tracerProviderProxy);

    setupEnvironment();
    const sdk = new NodeSDK(config);

    // TODO perhaps include some choice resource attrs in this log (sync ones): service.name, deployment.environment.name
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

    // To enable `@opentelemetry/host-metrics`:
    // - metrics should be enabled (resolved above)
    // - `ELASTIC_OTEL_HOST_METRICS_DISABLED` must not be "true"
    const hostMetricsDisabled = getBooleanFromEnv(
        'ELASTIC_OTEL_HOST_METRICS_DISABLED'
    );
    if (metricsEnabled && !hostMetricsDisabled) {
        const hostMetricsInstance = new HostMetrics();
        hostMetricsInstance.start();
    }

    // Setup for dynamic configuration of some SDK components.
    setupDynConfExporters(sdk);

    // `ELASTIC_OTEL_CONTEXT_PROPAGATION_ONLY` is effectively the static-config
    // equivalent of `send_traces=false`.
    const contextPropagationOnly = getBooleanFromEnv(
        'ELASTIC_OTEL_CONTEXT_PROPAGATION_ONLY'
    );
    if (contextPropagationOnly) {
        dynConfSpanExporters({enabled: false});
    }

    // OpAMP for central config.
    // TODO: handle resource in this SDK, so don't have use private `_resource`
    const opampClient = setupCentralConfig({
        // @ts-ignore: Ignore access of private _resource for now. (TODO)
        resource: sdk._resource,
        instrs,
        sdk,
        // TODO: Get some structure here. Perhaps our own SdkAdmin or SdkInfo class or whatever.
        noopTracerProvider,
        // @ts-ignore: Ignore access of private _tracerProvider for now. (TODO)
        sdkTracerProvider: sdk._tracerProvider,
        contextPropagationOnly,
    });

    // Shutdown handling.
    const shutdownFn = () => {
        const promises = [sdk.shutdown()];
        if (opampClient) {
            promises.push(opampClient.shutdown());
        }
        return Promise.all(promises).then(() => {});
    };
    if (config.elasticSetupShutdownHandlers ?? true) {
        setupShutdownHandlers(shutdownFn);
    }

    // Return an object that is a subset of the upstream NodeSDK interface,
    // just enough to shutdown.
    return {
        shutdown: shutdownFn,
    };
}

module.exports = {
    getInstrumentations,
    startNodeSDK,
    createDynConfSpanExporter, // TODO: doc this in API user guide
    createDynConfMetricExporter, // TODO: doc this in API user guide
    createDynConfLogRecordExporter, // TODO: doc this in API user guide

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
