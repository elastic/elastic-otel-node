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

/**
 * @typedef {import('@opentelemetry/sdk-node').NodeSDKConfiguration} NodeSDKConfiguration
 */

const os = require('os');

const {metrics, NodeSDK, api} = require('@opentelemetry/sdk-node');
const {
    envDetectorSync,
    hostDetectorSync,
    processDetectorSync,
} = require('@opentelemetry/resources');
const {BatchLogRecordProcessor} = require('@opentelemetry/sdk-logs');

const {log, registerOTelDiagLogger} = require('./logging');
const {distroDetectorSync} = require('./detector');
const {setupEnvironment, restoreEnvironment} = require('./environment');
const {getInstrumentations} = require('./instrumentations');
const {enableHostMetrics, HOST_METRICS_VIEWS} = require('./metrics/host');
// @ts-ignore - compiler options do not allow lookp outside `lib` folder
const DISTRO_VERSION = require('../package.json').version;

class ElasticNodeSDK extends NodeSDK {
    /**
     * @param {Partial<NodeSDKConfiguration>} opts
     */
    constructor(opts = {}) {
        log.trace('ElasticNodeSDK opts:', opts);
        registerOTelDiagLogger(api);

        // Setup & fix some env
        setupEnvironment();

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
            ],
        };

        // Use user's instrumetations or get the default ones
        defaultConfig.instrumentations =
            opts.instrumentations || getInstrumentations();

        // Protocols for exporters. Default is `http/proto`
        const exporterPkgNameFromEnvVar = {
            grpc: 'grpc',
            'http/json': 'http',
            'http/protobuf': 'proto',
        };
        // Get logs exporter protocol based on environment.
        const logsExportProtocol =
            process.env.OTEL_EXPORTER_OTLP_LOGS_PROTOCOL ||
            process.env.OTEL_EXPORTER_OTLP_PROTOCOL ||
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
        defaultConfig.logRecordProcessor = new BatchLogRecordProcessor(
            new OTLPLogExporter()
        );

        // Default metrics exporter.
        // Currently NodeSDK does not handle `OTEL_METRICS_EXPORTER`
        // https://opentelemetry.io/docs/concepts/sdk-configuration/general-sdk-configuration/#otel_metrics_exporter
        // For now we configure periodic (60s) export via OTLP/proto.
        // TODO metrics exporter should do for metrics what `TracerProviderWithEnvExporters` does for traces, does that include `url` export endpoint?
        // TODO what `temporalityPreference`?

        // Disable metrics by config
        const metricsDisabled =
            process.env.ELASTIC_OTEL_METRICS_DISABLED === 'true';
        if (!metricsDisabled) {
            // Get metrics exporter protocol based on environment.

            const metricsExportProtocol =
                process.env.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL ||
                process.env.OTEL_EXPORTER_OTLP_PROTOCOL ||
                'http/protobuf';
            let metricExporterType = exporterPkgNameFromEnvVar[metricsExportProtocol];
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
            // Note: Default values has been taken from the specs
            // https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#periodic-exporting-metricreader
            const metricsInterval =
                Number(process.env.OTEL_METRIC_EXPORT_INTERVAL) || 60000;
            const metricsTimeout =
                Number(process.env.OTEL_METRIC_EXPORT_TIMEOUT) || 30000;
            defaultConfig.metricReader =
                new metrics.PeriodicExportingMetricReader({
                    exporter: new OTLPMetricExporter(),
                    exportIntervalMillis: metricsInterval,
                    exportTimeoutMillis: metricsTimeout,
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

        /** @private */
        this._metricsDisabled = metricsDisabled;
        /** @private */
        this._log = log;
    }

    /**
     * Starts the SDK
     */
    start() {
        this._log.info(
            {
                preamble: true,
                distroVersion: DISTRO_VERSION,
                env: {
                    // For darwin: https://en.wikipedia.org/wiki/Darwin_%28operating_system%29#Release_history
                    os: `${os.platform()} ${os.release()}`,
                    arch: os.arch(),
                    runtime: `Node.js ${process.version}`,
                },
            },
            'start Elastic OpenTelemetry Node.js Distribution'
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
