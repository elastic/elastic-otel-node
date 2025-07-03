/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// This replicates the SDKs logic of getting processors from env

const {getStringListFromEnv, getStringFromEnv} = require('@opentelemetry/core');
const {
    BatchSpanProcessor,
    SimpleSpanProcessor,
    ConsoleSpanExporter,
} = require('@opentelemetry/sdk-trace-base');
const {log} = require('./logging');

/**
 * @typedef {import('@opentelemetry/sdk-trace-base').SpanProcessor} SpanProcessor
 * @typedef {import('@opentelemetry/sdk-trace-base').SpanExporter} SpanExporter
 */

const otlpPkgPrefix = '@opentelemetry/exporter-trace-otlp-';
const otlpProtocol =
    getStringFromEnv('OTEL_EXPORTER_OTLP_TRACES_PROTOCOL') ??
    getStringFromEnv('OTEL_EXPORTER_OTLP_PROTOCOL') ??
    'http/protobuf';

// Jaeger exporter is deprecated but upstream stills support it (for now)
// ref: https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/CHANGELOG.md#0440
function getJaegerExporter() {
    // The JaegerExporter does not support being required in bundled
    // environments. By delaying the require statement to here, we only crash when
    // the exporter is actually used in such an environment.
    try {
        // @ts-ignore
        const {JaegerExporter} = require('@opentelemetry/exporter-jaeger');
        return new JaegerExporter();
    } catch (e) {
        throw new Error(
            `Could not instantiate JaegerExporter. This could be due to the JaegerExporter's lack of support for bundling. If possible, use @opentelemetry/exporter-trace-otlp-proto instead. Original Error: ${e}`
        );
    }
}

/**
 * @param {'otlp' | 'zipkin' | 'jaeger' | 'console'} type
 * @returns {SpanExporter}
 */
function getSpanExporter(type) {
    if (type === 'zipkin') {
        const {ZipkinExporter} = require('@opentelemetry/exporter-zipkin');
        return new ZipkinExporter();
    } else if (type === 'jaeger') {
        return getJaegerExporter();
    } else if (type === 'console') {
        return new ConsoleSpanExporter();
    }

    let exporterPkgName = `${otlpPkgPrefix}`;
    switch (otlpProtocol) {
        case 'grpc':
            exporterPkgName += 'grpc';
            break;
        case 'http/json':
            exporterPkgName += 'http';
            break;
        case 'http/protobuf':
            exporterPkgName += 'proto';
            break;
        default:
            log.warn(
                `Unsupported OTLP traces protocol: ${otlpProtocol}. Using http/protobuf.`
            );
            exporterPkgName += 'proto';
    }
    const {OTLPTraceExporter} = require(exporterPkgName);
    return new OTLPTraceExporter();
}

/**
 * @returns {SpanProcessor[]}
 */
function getSpanProcessors() {
    // Get from env
    const exporters = getStringListFromEnv('OTEL_TRACES_EXPORTER') ?? [];
    const result = [];

    if (exporters[0] === 'none') {
        log.warn(
            'OTEL_TRACES_EXPORTER contains "none". No trace information or Spans will be exported.'
        );
        return [];
    }

    if (exporters.length === 0) {
        log.trace(
            'OTEL_TRACES_EXPORTER is empty. Using the default "otlp" exporter.'
        );
        exporters.push('otlp');
    } else if (exporters.length > 1 && exporters.includes('none')) {
        log.warn(
            'OTEL_TRACES_EXPORTER contains "none" along with other exporters. Using default otlp exporter.'
        );
        exporters.length = 0;
        exporters.push('otlp');
    }

    for (const name of exporters) {
        log.trace(`Initializing "${name}" traces exporter.`);
        switch (name) {
            case 'otlp':
                result.push(new BatchSpanProcessor(getSpanExporter('otlp')));
                break;
            case 'console':
                result.push(
                    new SimpleSpanProcessor(getSpanExporter('console'))
                );
                break;
            case 'zipkin':
                result.push(new BatchSpanProcessor(getSpanExporter('zipkin')));
                break;
            case 'jaeger':
                result.push(new BatchSpanProcessor(getJaegerExporter()));
                break;
            default:
                log.warn(`Unrecognized OTEL_TRACES_EXPORTER value: ${name}.`);
        }
    }

    return result;
}

module.exports = {
    getSpanProcessors,
};
