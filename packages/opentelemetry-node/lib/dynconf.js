/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Support for DYNamically CONFigurable ("DynConf") SDK components.

const {channel, subscribe, unsubscribe} = require('diagnostics_channel');

const {ExportResultCode} = require('@opentelemetry/core');

const {log} = require('./logging');

/**
 * @typedef {import('@opentelemetry/sdk-trace-base').SpanExporter} SpanExporter
 * @typedef {import('@opentelemetry/sdk-metrics').PushMetricExporter} PushMetricExporter
 * @typedef {import('@opentelemetry/sdk-logs').LogRecordExporter} LogRecordExporter
 *
 * @typedef {Object} DynConfSpanExportersEvent
 * @property {boolean} enabled
 *
 * @typedef {Object} DynConfMetricExportersEvent
 * @property {boolean} enabled
 *
 * @typedef {Object} DynConfLogRecordExportersEvent
 * @property {boolean} enabled
 */

/**
 * Diagnostics channels used to communicate changes to some config vars.
 */
const CH_SPAN_EXPORTERS = 'elastic-opentelemetry-node.dynconf.span-exporters';
const CH_METRIC_EXPORTERS =
    'elastic-opentelemetry-node.dynconf.metric-exporters';
const CH_LOG_RECORD_EXPORTERS =
    'elastic-opentelemetry-node.dynconf.log-record-exporters';

const chs = {
    [CH_SPAN_EXPORTERS]: channel(CH_SPAN_EXPORTERS),
    [CH_METRIC_EXPORTERS]: channel(CH_METRIC_EXPORTERS),
    [CH_LOG_RECORD_EXPORTERS]: channel(CH_LOG_RECORD_EXPORTERS),
};

/**
 * A SpanExporter that is dynamically configurable:
 * - It can be enabled/disabled dynamically. When enabled it proxies to a
 *   delegate SpanExporter.
 */
class DynConfSpanExporter {
    constructor(delegate) {
        this._delegate = delegate;
        this._enabled = true;
        this._boundSub = this._onChange.bind(this); // save for unsubscribe()
        subscribe(CH_SPAN_EXPORTERS, this._boundSub);
    }
    /**
     * @param {DynConfSpanExportersEvent} chEvent
     */
    _onChange(chEvent) {
        if (typeof chEvent.enabled !== 'boolean') {
            log.warn(
                `unexpected "${CH_SPAN_EXPORTERS}" channel event: ${chEvent}`
            );
        } else {
            this._enabled = chEvent.enabled;
        }
    }

    // interface SpanExporter
    export(spans, resultCallback) {
        if (this._enabled) {
            return this._delegate.export(spans, resultCallback);
        } else {
            resultCallback({code: ExportResultCode.SUCCESS});
        }
    }
    shutdown() {
        unsubscribe(CH_SPAN_EXPORTERS, this._boundSub);
        if (this._enabled) {
            return this._delegate.shutdown();
        } else {
            return Promise.resolve();
        }
    }
    forceFlush() {
        if (this._enabled) {
            return this._delegate.forceFlush();
        } else {
            return Promise.resolve();
        }
    }
}

/**
 * @param {SpanExporter} exporter
 * @returns {SpanExporter}
 */
function createDynConfSpanExporter(exporter) {
    return new DynConfSpanExporter(exporter);
}

/**
 * Do a *best effort* to wrap the SpanExporter of the given SpanProcessor
 * with `createDynConfSpanExporter()`. This handles sub-SpanProcessors of a
 * MultiSpanProcessor.
 *
 * This is *best effort* because we are accessing semi-private properties of
 * well-known OTel JS SDK classes. This `log.warn`'s if it could not wrap
 * an exporter as expected.
 */
function _dynConfWrapSpanProcessors(sp) {
    if (!sp) {
        log.warn('could not setup SpanProcessors for dynamic config');
        return;
    }
    const className = sp.constructor?.name;
    switch (className) {
        case 'MultiSpanProcessor':
            sp._spanProcessors?.forEach((s) => _dynConfWrapSpanProcessors(s));
            break;

        case 'BatchSpanProcessor':
        case 'SimpleSpanProcessor':
            if (sp._exporter) {
                // Avoid double-wrapping, in case the bootstrap code already
                // explicitly used `createDynConfSpanExporter()`.
                if (sp._exporter.constructor !== DynConfSpanExporter) {
                    const wrapped = createDynConfSpanExporter(sp._exporter);
                    sp._exporter = wrapped;
                }
            } else {
                log.warn(
                    `could not setup exporter on "${className}" span processor for dynamic config`
                );
            }
            break;

        case 'NoopSpanProcessor':
            // pass
            break;

        default:
            // Avoid warning if the bootstrap code already used the suggested `createDynConfSpanExporter()`
            // to wrap this SpanProcessor's exporter (*guessed* to be at the `_exporter` property).
            if (
                !sp._exporter ||
                sp._exporter.constructor !== DynConfSpanExporter
            ) {
                log.warn(
                    `could not setup "${className}" span processor for dynamic config: use \`createDynConfSpanExporter(exporter)\` to enable dynamic configuration of your exporter`
                );
            }
            break;
    }
}

/**
 * Dynamically configure the SDK's SpanExporters.
 *
 * @param {DynConfSpanExportersEvent} config
 */
function dynConfSpanExporters(config) {
    chs[CH_SPAN_EXPORTERS].publish(config);
}

/**
 * A PushMetricExporter that is dynamically configurable:
 * - It can be enabled/disabled dynamically. When enabled it proxies to a
 *   delegate PushMetricExporter.
 *
 * @interface {PushMetricExporter}
 */
class DynConfMetricExporter {
    constructor(delegate) {
        this._delegate = delegate;
        this._enabled = true;
        this._boundSub = this._onChange.bind(this); // save for unsubscribe()
        subscribe(CH_METRIC_EXPORTERS, this._boundSub);
    }
    /**
     * @param {DynConfMetricExportersEvent} chEvent
     */
    _onChange(chEvent) {
        if (typeof chEvent.enabled !== 'boolean') {
            log.warn(
                `unexpected "${CH_METRIC_EXPORTERS}" channel event: ${chEvent}`
            );
        } else {
            this._enabled = chEvent.enabled;
        }
    }

    // interface PushMetricExporter
    export(metrics, resultCallback) {
        if (this._enabled) {
            return this._delegate.export(metrics, resultCallback);
        } else {
            resultCallback({code: ExportResultCode.SUCCESS});
        }
    }
    shutdown() {
        unsubscribe(CH_METRIC_EXPORTERS, this._boundSub);
        if (this._enabled) {
            return this._delegate.shutdown();
        } else {
            return Promise.resolve();
        }
    }
    forceFlush() {
        if (this._enabled) {
            return this._delegate.forceFlush();
        } else {
            return Promise.resolve();
        }
    }
    selectAggregationTemporality(instrumentType) {
        return this._delegate.selectAggregationTemporality(instrumentType);
    }
    selectAggregation(instrumentType) {
        return this._delegate.selectAggregation(instrumentType);
    }
}

/**
 * @param {PushMetricExporter} exporter
 * @returns {PushMetricExporter}
 */
function createDynConfMetricExporter(exporter) {
    return new DynConfMetricExporter(exporter);
}

function _dynConfWrapMetricReader(mr) {
    if (!mr) {
        log.warn('could not setup MetricReader for dynamic config');
        return;
    }
    const className = mr.constructor?.name;
    switch (className) {
        case 'PeriodicExportingMetricReader':
            if (mr._exporter.constructor !== DynConfMetricExporter) {
                const wrapped = createDynConfMetricExporter(mr._exporter);
                mr._exporter = wrapped;
            }
            break;

        default:
            log.warn(
                `could not setup "${className}" metric reader for dynamic config: use \`createDynConfMetricExporter(exporter)\` to enable dynamic configuration of your exporter`
            );
            break;
    }
}

/**
 * Dynamically configure the SDK's metric exporters.
 *
 * @param {DynConfMetricExportersEvent} config
 */
function dynConfMetricExporters(config) {
    chs[CH_METRIC_EXPORTERS].publish(config);
}

/**
 * A LogRecordExporter that is dynamically configurable:
 * - It can be enabled/disabled dynamically. When enabled it proxies to a
 *   delegate LogRecordExporter.
 */
class DynConfLogRecordExporter {
    constructor(delegate) {
        this._delegate = delegate;
        this._enabled = true;
        this._boundSub = this._onChange.bind(this); // save for unsubscribe()
        subscribe(CH_LOG_RECORD_EXPORTERS, this._boundSub);
    }
    /**
     * @param {DynConfLogRecordExportersEvent} chEvent
     */
    _onChange(chEvent) {
        if (typeof chEvent.enabled !== 'boolean') {
            log.warn(
                `unexpected "${CH_LOG_RECORD_EXPORTERS}" channel event: ${chEvent}`
            );
        } else {
            this._enabled = chEvent.enabled;
        }
    }

    // interface LogRecordExporter
    export(logRecords, resultCallback) {
        if (this._enabled) {
            return this._delegate.export(logRecords, resultCallback);
        } else {
            resultCallback({code: ExportResultCode.SUCCESS});
        }
    }
    shutdown() {
        unsubscribe(CH_LOG_RECORD_EXPORTERS, this._boundSub);
        if (this._enabled) {
            return this._delegate.shutdown();
        } else {
            return Promise.resolve();
        }
    }
}

/**
 * @param {LogRecordExporter} exporter
 * @returns {LogRecordExporter}
 */
function createDynConfLogRecordExporter(exporter) {
    return new DynConfLogRecordExporter(exporter);
}

/**
 * Do a *best effort* to wrap the LogRecordExporter of the given processor
 * with `createDynConfLogRecordExporter()`.
 *
 * This is *best effort* because we are accessing semi-private properties of
 * well-known OTel JS SDK classes. This `log.warn`'s if it could not wrap
 * an exporter as expected.
 */
function _dynConfWrapLogRecordProcessors(lp) {
    if (!lp) {
        log.warn('could not setup LogRecordProcessors for dynamic config');
        return;
    }
    const className = lp.constructor?.name;
    switch (className) {
        case 'MultiLogRecordProcessor':
            lp.processors?.forEach((p) => _dynConfWrapLogRecordProcessors(p));
            break;

        case 'BatchLogRecordProcessor':
        case 'SimpleLogRecordProcessor':
            if (lp._exporter) {
                // Avoid double-wrapping, in case the bootstrap code already
                // explicitly used `createDynConfLogRecordExporter()`.
                if (lp._exporter.constructor !== DynConfLogRecordExporter) {
                    const wrapped = createDynConfLogRecordExporter(
                        lp._exporter
                    );
                    lp._exporter = wrapped;
                }
            } else {
                log.warn(
                    `could not setup exporter on "${className}" log record processor for dynamic config`
                );
            }
            break;

        case 'NoopLogRecordProcessor':
            // pass
            break;

        default:
            // Avoid warning if the bootstrap code already used the suggested
            // `createDynConfLogRecordExporter()` to wrap this
            // LogRecordProcessor's exporter (*guessed* to be at the `_exporter`
            // property).
            if (
                !lp._exporter ||
                lp._exporter.constructor !== DynConfLogRecordExporter
            ) {
                log.warn(
                    `could not setup "${className}" log record processor for dynamic config: use \`createDynConfLogRecordExporter(exporter)\` to enable dynamic configuration of your exporter`
                );
            }
            break;
    }
}

/**
 * Dynamically configure the SDK's metric exporters.
 *
 * @param {DynConfLogRecordExportersEvent} config
 */
function dynConfLogRecordExporters(config) {
    chs[CH_LOG_RECORD_EXPORTERS].publish(config);
}

/**
 * We want exporters (SpanExporter, LogRecordExporter, et al) to be
 * dynamically configurable for some central-config settings.
 *
 * A note in the OTel SDK configuration spec suggests this may eventually be
 * supported (https://opentelemetry.io/docs/specs/otel/configuration/sdk/#config-operations):
 *
 * > TODO: Add operation to update SDK components with new configuration for usage with OpAmp
 *
 * As a workaround for now:
 * 1. We automatically *reach into the internal structure* of OTel JS SDK
 *    components to find the exporter instances, and monkey-patch them. This
 *    works (a) for known SDK exporter classes and (b) for now. Yes this is a
 *    maintenance burden: upstream non-breaking releases could break this.
 * 2. For custom SDK bootstrap code, we export `createDynConf*` utilities that
 *    can be used to wrap particular SDK components for dynamic configuration.
 *
 * To support loose coupling between SDK and dynamically configurable components
 * **diagnostics_channel is used to communicate config changes**. The loose
 * coupling is needed to avoid needing to *register* components with the SDK
 * after the SDK is created.
 */
function setupDynConfExporters(sdk) {
    // Span exporters.
    _dynConfWrapSpanProcessors(sdk._tracerProvider?._activeSpanProcessor);

    // Metric exporters.
    for (let mc of sdk._meterProvider?._sharedState?.metricCollectors || []) {
        if (mc._metricReader) {
            _dynConfWrapMetricReader(mc._metricReader);
        }
    }

    // Log record exporters.
    _dynConfWrapLogRecordProcessors(
        sdk._loggerProvider?._sharedState?.activeProcessor
    );
}

module.exports = {
    setupDynConfExporters,
    dynConfSpanExporters,
    dynConfMetricExporters,
    dynConfLogRecordExporters,

    // API to be exported for the SDK API.
    createDynConfSpanExporter,
    createDynConfMetricExporter,
    createDynConfLogRecordExporter,
};
