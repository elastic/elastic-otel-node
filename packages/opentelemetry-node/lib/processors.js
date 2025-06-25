/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// This replicates the SDKs logic of getting processors from env
// and also adds a new one to collect span metrics like:
// - metric.otel.sdk.span.live.count
// - metric.otel.sdk.span.ended.count

const {metrics} = require('@opentelemetry/api');
const {getStringListFromEnv, getStringFromEnv} = require('@opentelemetry/core');
const {
    BatchSpanProcessor,
    SimpleSpanProcessor,
    ConsoleSpanExporter,
} = require('@opentelemetry/sdk-trace-base');
const {log} = require('./logging');

/**
 * @typedef {import('@opentelemetry/api').Meter} Meter
 * @typedef {import('@opentelemetry/api').UpDownCounter} UpDownCounter
 * @typedef {import('@opentelemetry/api').Counter} Counter
 * @typedef {import('@opentelemetry/sdk-trace-base').SpanProcessor} SpanProcessor
 * @typedef {import('@opentelemetry/sdk-trace-base').SpanExporter} SpanExporter
 */

// @ts-ignore - compiler options do not allow lookp outside `lib` folder
const ELASTIC_PKG = require('../package.json');
const ELASTIC_SDK_VERSION = ELASTIC_PKG.version;
const ELASTIC_SDK_SCOPE = ELASTIC_PKG.name;

const otlpPkgPreffix = '@opentelemetry/exporter-trace-otlp-';
const otlpProtocol =
    getStringFromEnv('OTEL_EXPORTER_OTLP_TRACES_PROTOCOL') ??
    getStringFromEnv('OTEL_EXPORTER_OTLP_PROTOCOL') ??
    'http/protobuf';

// NOTE: assuming the meter provider is not going to be replaced once
// the EDOT is started we can cache the meter and metrics in these vars
/** @type {Meter} */
let selfMetricsMeter;
/** @type {UpDownCounter} */
let liveSpans;
/** @type {Counter} */
let closedSpans;

/**
 * @returns {Meter}
 */
function getSpansMeter() {
    if (selfMetricsMeter) {
        return selfMetricsMeter;
    }
    selfMetricsMeter = metrics.getMeter(ELASTIC_SDK_SCOPE, ELASTIC_SDK_VERSION);
    return selfMetricsMeter;
}

/**
 * @returns {UpDownCounter}
 */
function getLiveSpansCounter() {
    if (liveSpans) {
        return liveSpans;
    }
    liveSpans = getSpansMeter().createUpDownCounter(
        'otel.sdk.span.live.count',
        {
            description:
                'Number of created spans for which the end operation has not been called yet',
        }
    );
    return liveSpans;
}

/**
 * @returns {Counter}
 */
function getClosedSpansCounter() {
    if (closedSpans) {
        return closedSpans;
    }
    closedSpans = getSpansMeter().createCounter('otel.sdk.span.closed.count', {
        description:
            'Number of created spans for which the end operation was called',
    });
    return closedSpans;
}

/** @type {SpanProcessor} */
const spanMetricsPrcessor = {
    forceFlush: function () {
        return Promise.resolve();
    },
    onStart: function (span, parentContext) {
        getLiveSpansCounter().add(1);
    },
    onEnd: function (span) {
        getLiveSpansCounter().add(-1);
        getClosedSpansCounter().add(1);
    },
    shutdown: function () {
        return Promise.resolve();
    },
};

/**
 * @param {'otlp' | 'zipkin' | 'jaeger' | 'console'} type
 * @returns {SpanExporter}
 */
function getSpanExporter(type) {
    if (type === 'zipkin') {
        const {ZipkinExporter} = require('@opentelemetry/exporter-zipkin');
        return new ZipkinExporter();
    } else if (type === 'jaeger') {
        // TODO: this should be installed and there is a possible issue with bundlers. refs:
        // - is a dev-dependency? https://github.com/open-telemetry/opentelemetry-js/blob/ec17ce48d0e5a99a122da5add612a20e2dd84ed5/experimental/packages/opentelemetry-sdk-node/package.json#L76
        // - surreunded with try catch in https://github.com/open-telemetry/opentelemetry-js/blob/ec17ce48d0e5a99a122da5add612a20e2dd84ed5/experimental/packages/opentelemetry-sdk-node/src/utils.ts#L120
        // const {JaegerExporter} = require('@opentelemetry/exporter-jaeger');
        // result.push(new BatchSpanProcessor(new JaegerExporter()));
    } else if (type === 'console') {
        return new ConsoleSpanExporter();
    }

    let exporterPkgName = `${otlpPkgPreffix}`;
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
 * @param {SpanProcessor[]} [processors]
 */
function getSpanProcessors(processors) {
    const metricsExporters =
        getStringListFromEnv('OTEL_METRICS_EXPORTER') || [];
    const metricsEnabled = metricsExporters.every((e) => e !== 'none');

    if (Array.isArray(processors)) {
        if (metricsEnabled) {
            processors.push(spanMetricsPrcessor);
        }
        return processors;
    }

    // Get from env
    const exporters = getStringListFromEnv('OTEL_TRACES_EXPORTER') ?? [];
    const result = metricsEnabled ? [spanMetricsPrcessor] : [];

    if (exporters.some((exp) => exp === 'none')) {
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
                // TODO: check comment in `getSpanExporter` function
                // result.push(new BatchSpanProcessor(getSpanExporter('zipkin')));
                log.warn(
                    `OTEL_TRACES_EXPORTER value "${name}" not available yet.`
                );
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
