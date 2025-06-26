/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Gets the SDK configuration and updates it to have instruments
// to collect metrics related to the SDK, for now:
// - otel.sdk.span.live
// - otel.sdk.span.ended

const {metrics, TraceFlags} = require('@opentelemetry/api');
const {
    METRIC_OTEL_SDK_SPAN_ENDED,
    METRIC_OTEL_SDK_SPAN_LIVE,
    ATTR_OTEL_SPAN_SAMPLING_RESULT,
    OTEL_SPAN_SAMPLING_RESULT_VALUE_RECORD_AND_SAMPLE,
    OTEL_SPAN_SAMPLING_RESULT_VALUE_RECORD_ONLY,
} = require('./semconv');

/**
 * @typedef {import('@opentelemetry/api').Meter} Meter
 * @typedef {import('@opentelemetry/api').UpDownCounter} UpDownCounter
 * @typedef {import('@opentelemetry/api').Counter} Counter
 * @typedef {import('@opentelemetry/sdk-trace-base').Span} Span
 * @typedef {import('@opentelemetry/sdk-trace-base').ReadableSpan} ReadableSpan
 * @typedef {import('@opentelemetry/sdk-trace-base').SpanProcessor} SpanProcessor
 */

// @ts-ignore - compiler options do not allow lookp outside `lib` folder
const ELASTIC_PKG = require('../package.json');
const ELASTIC_SDK_VERSION = ELASTIC_PKG.version;
const ELASTIC_SDK_SCOPE = ELASTIC_PKG.name;

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
    // NOTE: we have a metter for a single scope which is the EDOT package
    // TODO: check WWJD (what would Java do?)
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
    liveSpans = getSpansMeter().createUpDownCounter(METRIC_OTEL_SDK_SPAN_LIVE, {
        description:
            'Number of created spans for which the end operation has not been called yet',
    });
    return liveSpans;
}

/**
 * @returns {Counter}
 */
function getEndedSpansCounter() {
    if (closedSpans) {
        return closedSpans;
    }
    closedSpans = getSpansMeter().createCounter(METRIC_OTEL_SDK_SPAN_ENDED, {
        description:
            'Number of created spans for which the end operation was called',
    });
    return closedSpans;
}

/**
 * All Spans treated in SpanProcessors are recording so here none will have
 * a "DROP" sampling result
 * @param {Span | ReadableSpan} span
 * @returns {string}
 */
function getSamplingResult(span) {
    const isSampled = span.spanContext().traceFlags & TraceFlags.SAMPLED;
    return isSampled
        ? OTEL_SPAN_SAMPLING_RESULT_VALUE_RECORD_AND_SAMPLE
        : OTEL_SPAN_SAMPLING_RESULT_VALUE_RECORD_ONLY;
}

/** @type {SpanProcessor} */
const spanMetricsProcessor = {
    forceFlush: function () {
        return Promise.resolve();
    },
    onStart: function (span) {
        getLiveSpansCounter().add(1, {
            [ATTR_OTEL_SPAN_SAMPLING_RESULT]: getSamplingResult(span),
        });
    },
    onEnd: function (span) {
        const attrs = {
            [ATTR_OTEL_SPAN_SAMPLING_RESULT]: getSamplingResult(span),
        };
        getLiveSpansCounter().add(-1, attrs);
        getEndedSpansCounter().add(1, attrs);
    },
    shutdown: function () {
        return Promise.resolve();
    },
};

/**
 *
 * @param {Partial<import('@opentelemetry/sdk-node').NodeSDKConfiguration>} cfg
 * @returns
 */
function setupSdkMetrics(cfg) {
    cfg.spanProcessors.push(spanMetricsProcessor);
}

module.exports = {
    setupSdkMetrics,
};
