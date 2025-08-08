/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Support for DYNamically CONFigurable ("DynConf") SDK components.

const {channel, subscribe, unsubscribe} = require('diagnostics_channel');

const {ExportResultCode} = require('@opentelemetry/core');

const {log} = require('./logging');

/**
 * @typedef {Object} DynConfSpanExportersEvent
 * @property {boolean} enabled
 */

/**
 * Diagnostics channels used to communicate changes to some config vars.
 */
const CH_SPAN_EXPORTERS = 'elastic-opentelemetry-node.dynconf.span-exporters';

const chs = {
    [CH_SPAN_EXPORTERS]: channel(CH_SPAN_EXPORTERS),
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
                const wrapped = new DynConfSpanExporter(sp._exporter);
                sp._exporter = wrapped;
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
            log.warn(
                `could not setup "${className}" span processor for dynamic config`
            );
            break;
    }
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
 *    maintenance burden.
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

    // TODO: For dev. Remove this later.
    console.log(
        'XXX SDK exporters: ',
        sdk._tracerProvider._activeSpanProcessor._spanProcessors.map(
            (p) => p._exporter
        ),
        sdk._meterProvider._sharedState.metricCollectors.map(
            (c) => c._metricReader._exporter
        ),
        sdk._loggerProvider._sharedState.activeProcessor.processors.map(
            (p) => p._exporter
        )
    );
}

/**
 * Dynamically configure the SDK's SpanExporters.
 *
 * @param {DynConfSpanExportersEvent} config
 */
function dynConfSpanExporters(config) {
    chs[CH_SPAN_EXPORTERS].publish(config);
}

module.exports = {
    setupDynConfExporters,
    dynConfSpanExporters,
};
