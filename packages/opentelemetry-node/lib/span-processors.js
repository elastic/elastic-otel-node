/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * This file contains a fragment node SDK utils
 * used by this package.
 * @see https://github.com/open-telemetry/opentelemetry-js/tree/main/semantic-conventions#unstable-semconv
 */

const {
    getStringListFromEnv,
    getStringFromEnv,
} = require('@opentelemetry/core');
const {
    BatchSpanProcessor,
    SimpleSpanProcessor,
    ConsoleSpanExporter,
} = require('@opentelemetry/sdk-trace-base');
const {
    ZipkinExporter,
} = require('@opentelemetry/exporter-zipkin');

const { log } = require('./logging');

/**
 * @typedef {import('@opentelemetry/sdk-trace-base').SpanExporter} SpanExporter
 */
/**
 * @typedef {import('@opentelemetry/sdk-trace-base').SpanProcessor} SpanProcessor
 */

/**
 * @returns {SpanExporter}
 */
function getOtlpExporterFromEnv() {
    const exporterPkgNameFromEnvVar = {
        grpc: 'grpc',
        'http/json': 'http',
        'http/protobuf': 'proto', // default
    };
    const tracesExportProtocol =
        getStringFromEnv('OTEL_EXPORTER_OTLP_TRACES_PROTOCOL') ||
        getStringFromEnv('OTEL_EXPORTER_OTLP_PROTOCOL') ||
        'http/protobuf';

    let tracesExporterType =
        exporterPkgNameFromEnvVar[tracesExportProtocol];
    if (!tracesExporterType) {
        log.warn(
            `Traces exporter protocol "${tracesExportProtocol}" unknown. Using default "http/protobuf" protocol`
        );
        tracesExporterType = 'proto';
    }
    log.trace(
        `Traces exporter protocol set to ${tracesExportProtocol}`
    );
    const {OTLPTraceExporter} = require(
        `@opentelemetry/exporter-trace-otlp-${tracesExporterType}`
    );
    return new OTLPTraceExporter();
}

/**
 * @returns {SpanProcessor[]}
 */
function getSpanProcessorsFromEnv() {
    /** @type {Map<string, () => SpanExporter>} */
    const exportersMap = new Map([
        ['otlp', () => getOtlpExporterFromEnv()],
        ['zipkin', () => new ZipkinExporter()],
        ['console', () => new ConsoleSpanExporter()],
        // disabed for now
        // ['jaeger', () => getJaegerExporter()],
    ]);
    /** @type {SpanExporter[]} */
    const exporters = [];
    /** @type {SpanProcessor[]} */
    const processors = [];
    let traceExportersList = Array.from(new Set(getStringListFromEnv('OTEL_TRACES_EXPORTER')));

    if (traceExportersList[0] === 'none') {
        log.warn(
            'OTEL_TRACES_EXPORTER contains "none". SDK will not be initialized.'
        );
        return [];
    }

    if (traceExportersList.length === 0) {
        log.debug('OTEL_TRACES_EXPORTER is empty. Using default otlp exporter.');
        traceExportersList = ['otlp'];
    } else if (
        traceExportersList.length > 1 &&
        traceExportersList.includes('none')
    ) {
        log.warn(
            'OTEL_TRACES_EXPORTER contains "none" along with other exporters. Using default otlp exporter.'
        );
        traceExportersList = ['otlp'];
    }

    for (const name of traceExportersList) {
        const exporter = exportersMap.get(name)?.();
        if (exporter) {
            exporters.push(exporter);
        } else {
            log.warn(`Unrecognized OTEL_TRACES_EXPORTER value: ${name}.`);
        }
    }

    for (const exp of exporters) {
        if (exp instanceof ConsoleSpanExporter) {
            processors.push(new SimpleSpanProcessor(exp));
        } else {
            processors.push(new BatchSpanProcessor(exp));
        }
    }

    if (exporters.length === 0) {
        log.warn(
            'Unable to set up trace exporter(s) due to invalid exporter and/or protocol values.'
        );
    }

    return processors;
}

module.exports = {
    getSpanProcessorsFromEnv
};
