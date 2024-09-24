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
 * Utilities for normalizing OTLP proto/json objects to a form that is common
 * between the flavours and somewhat more convenient to use for
 * testing/debugging.
 */

const Long = require('long');

const {getProtoRoot} = require('./proto');

// `enum SpanKind` in "trace.proto".
const SpanKind = getProtoRoot().lookupType(
    'opentelemetry.proto.trace.Span'
).SpanKind;
const spanKindEnumFromVal = {
    [SpanKind.SPAN_KIND_UNSPECIFIED]: 'SPAN_KIND_UNSPECIFIED',
    [SpanKind.SPAN_KIND_INTERNAL]: 'SPAN_KIND_INTERNAL',
    [SpanKind.SPAN_KIND_SERVER]: 'SPAN_KIND_SERVER',
    [SpanKind.SPAN_KIND_CLIENT]: 'SPAN_KIND_CLIENT',
    [SpanKind.SPAN_KIND_PRODUCER]: 'SPAN_KIND_PRODUCER',
    [SpanKind.SPAN_KIND_CONSUMER]: 'SPAN_KIND_CONSUMER',
};

// `enum SpanKind` in "trace.proto".
const StatusCode = getProtoRoot().lookupType(
    'opentelemetry.proto.trace.Status'
).StatusCode;
const statusCodeEnumFromVal = {
    [StatusCode.STATUS_CODE_UNSET]: 'STATUS_CODE_UNSET',
    [StatusCode.STATUS_CODE_OK]: 'STATUS_CODE_OK',
    [StatusCode.STATUS_CODE_ERROR]: 'STATUS_CODE_ERROR',
};

/**
 * Normalize an 'attributes' value, for example in:
 *      [ { key: 'telemetry.sdk.version', value: { stringValue: '1.19.0' } },
 *        { key: 'process.pid', value: { intValue: '19667' } } ]
 * to a value for converting 'attributes' to a simpler object, e.g.:
 *      { 'telemetry.sdk.version': '1.19.0',
 *        'process.pid': 19667 }
 *
 * @param {import('./types-proto').opentelemetry.proto.common.v1.IAnyValue} v
 * @returns {any}
 */
function normAttrValue(v) {
    if ('stringValue' in v) {
        return v.stringValue;
    } else if ('boolValue' in v) {
        return v.boolValue;
    } else if ('doubleValue' in v) {
        return v.doubleValue;
    } else if ('arrayValue' in v) {
        return v.arrayValue.values.map(normAttrValue);
    } else if ('intValue' in v) {
        // The OTLP/json serialization uses JS Number for these, so we'll
        // do the same. TODO: Is there not a concern with a 64-bit value?
        if (typeof v.intValue === 'number') {
            return v.intValue;
        } else if (typeof v.intValue === 'string') {
            return Number(v.intValue);
        } else if (typeof v.intValue === 'object' && 'low' in v.intValue) {
            return new Long(
                v.intValue.low,
                v.intValue.high,
                v.intValue.unsigned
            ).toString();
        }
    } else if ('kvlistValue' in v) {
        const obj = {};
        if (v.kvlistValue.values) {
            for (let keyValue of v.kvlistValue.values) {
                obj[keyValue.key] = normAttrValue(keyValue.value);
            }
        }
        return obj;
    } else if ('bytesValue' in v) {
        // 'bytesValue' is used to encode Uint8Array's. At least with the proto
        // flavour, `v.bytesValue` is a Node.js Buffer.
        // https://nodejs.org/api/all.html#all_buffer_buffers-and-typedarrays says:
        // > Buffer instances are also JavaScript Uint8Array and TypedArray instances.
        // However, returning just `v.bytesValue` behaves differently.
        return new Uint8Array(v.bytesValue);
    } else if (Object.keys(v).length === 0) {
        // Representing an empty value:
        // - proto serialization: KeyValue { key: 'signal', value: AnyValue {} }
        // - json serialization: { key: 'code', value: {} }
        // This normalization will use `null`.
        return null;
    }
    throw new Error(
        `unexpected type of attributes value: ${JSON.stringify(v)}`
    );
}

/**
 * JSON stringify an OTLP trace service request to one *possible* representation.
 *
 * Getting the same JSON representation of an OTLP trace service request,
 * regardless of which OTLP flavour was used, has some surprises.
 *
 * Notes:
 * - *OTLP/proto* requests return a `protobuf` object hierarchy (see
 *   opentelemetry-js/experimental/packages/otlp-proto-exporter-base/src/generated/root.js).
 *   These classes include `.toJSON` methods that apply some opinions on how to
 *   convert some fields, using these default options:
 *   https://github.com/protobufjs/protobuf.js/blob/protobufjs-v7.2.5/src/util/minimal.js#L395-L416
 *      - Binary data (including spanId) to *base64*.
 *      - Longs to strings.
 *      - Enums to strings.
 *      - NaN and Infinity to strings.
 *   For example:
 *      "spanId": "l38srd+eIyk=",
 *      "kind": "SPAN_KIND_SERVER",
 *      "startTimeUnixNano": "1703204488211000000",
 * - *OTLP/gRPC* requests return an object with `Buffer` for binary data,
 *   `Long` for 64-bit integer values, and enums left as a number:
 *      spanId: Buffer(8) [Uint8Array] [ 251, 108, 69, 242, 165, 207, 23, 37 ],
 *      startTimeUnixNano: Long { low: 214824256, high: 396558489, unsigned: true },
 *      kind: 2,
 *   There are no `.toJSON` methods, so these JSON serialize poorly as is.
 * - *OTLP/json* requests return an object with spanId et al already converted
 *   to hex format, `Long` to strings, and enums left as a number:
 *      spanId: 'ed027387e1755312',
 *      startTimeUnixNano: '1703205196340000000',
 *      kind: 2,
 *
 * This implementation:
 * - converts `traceId`, `spanId`, `parentSpanId` to hex
 * - converts `span.kind` and `span.status.code` to their enum string value
 * - converts longs to string
 *
 * Limitations:
 * - We are using `json: true` for protobufjs conversion, which isn't applied
 *   for the other flavours.
 * - Q: Are there other Binary fields we need to worry about?
 *
 * @param {any} trace
 * @param {object} opts
 * @param {number} [opts.indent] - indent option to pass to `JSON.stringify()`.
 * @param {boolean} [opts.normAttributes] - whether to convert 'attributes' to
 *      an object (rather than the native array of {key, value} objects).
 * @param {boolean} [opts.stripResource] - exclude the 'resource' property, for brevity.
 * @param {boolean} [opts.stripAttributes] - exclude 'attributes' properties, for brevity.
 * @param {boolean} [opts.stripScope] - exclude 'scope' property, for brevity.
 */
function jsonStringifyTrace(trace, opts) {
    const replacer = (k, v) => {
        let rv = v;
        switch (k) {
            case 'resource':
                if (opts.stripResource) {
                    rv = undefined;
                }
                break;
            case 'attributes':
                if (opts.stripAttributes) {
                    rv = undefined;
                } else if (opts.normAttributes) {
                    rv = {};
                    for (let i = 0; i < v.length; i++) {
                        const attr = v[i];
                        rv[attr.key] = normAttrValue(attr.value);
                    }
                }
                break;
            case 'scope':
                if (opts.stripScope) {
                    rv = undefined;
                }
                break;
            case 'kind':
                /* eslint-disable no-prototype-builtins */
                if (spanKindEnumFromVal.hasOwnProperty(v)) {
                    rv = spanKindEnumFromVal[v];
                }
                break;
            case 'status':
                if (
                    'code' in v &&
                    statusCodeEnumFromVal.hasOwnProperty(v.code)
                ) {
                    v.code = statusCodeEnumFromVal[v.code];
                }
                break;
            case 'traceId':
            case 'spanId':
            case 'parentSpanId':
                // v.toJSON() will already have been called, converting it from
                // a Buffer to an object... which is just a waste of time.
                if (v.type === 'Buffer') {
                    rv = Buffer.from(v.data).toString('hex');
                }
                break;
            case 'startTimeUnixNano':
            case 'endTimeUnixNano':
                // OTLP/gRPC time fields are `Long` (https://github.com/dcodeIO/Long.js),
                // converted to a plain object. Convert them to a string to
                // match the other flavour.
                if (typeof v === 'object' && 'low' in v) {
                    rv = new Long(v.low, v.high, v.unsigned).toString();
                }
                break;
        }
        return rv;
    };

    let norm;
    if (typeof trace.constructor.toObject === 'function') {
        // Normalize `ExportTraceServiceRequest` from OTLP/proto request
        // with our custom options.
        norm = trace.constructor.toObject(trace, {
            longs: String,
            json: true, // TODO not sure about using this, b/c it differs from other flavours
        });
    } else {
        norm = trace;
    }

    return JSON.stringify(norm, replacer, opts.indent || 0);
}

/**
 * Normalize the given raw TraceServiceRequest.
 * - converts `traceId`, `spanId`, `parentSpanId` to hex
 * - converts `span.kind` and `span.status.code` to their enum string value
 * - converts longs to string
 *
 * See `jsonStringifyTrace()` for full notes.
 */
function normalizeTrace(rawTrace) {
    const str = jsonStringifyTrace(rawTrace, {
        normAttributes: true,
    });
    return JSON.parse(str);
}

/**
 * JSON stringify an OTLP metrics service request to one *possible* representation.
 *
 * This implementation:
 * - converts `startTimeUnixNano` and `timeUnixNano` longs to string
 *
 * Limitations:
 * - We are using `json: true` for protobufjs conversion, which isn't applied
 *   for the other flavours.
 * - TODO: convert aggregationTemporality to enum string?
 *
 * @param {any} metrics
 * @param {object} opts
 * @param {number} [opts.indent] - indent option to pass to `JSON.stringify()`.
 * @param {boolean} [opts.normAttributes] - whether to convert 'attributes' to
 *      an object (rather than the native array of {key, value} objects).
 * @param {boolean} [opts.stripResource] - exclude the 'resource' property, for brevity.
 * @param {boolean} [opts.stripAttributes] - exclude 'attributes' properties, for brevity.
 * @param {boolean} [opts.stripScope] - exclude 'scope' property, for brevity.
 */
function jsonStringifyMetrics(metrics, opts) {
    const replacer = (k, v) => {
        let rv = v;
        switch (k) {
            case 'resource':
                if (opts.stripResource) {
                    rv = undefined;
                }
                break;
            case 'attributes':
                if (opts.stripAttributes) {
                    rv = undefined;
                } else if (opts.normAttributes) {
                    rv = {};
                    for (let i = 0; i < v.length; i++) {
                        const attr = v[i];
                        rv[attr.key] = normAttrValue(attr.value);
                    }
                }
                break;
            case 'scope':
                if (opts.stripScope) {
                    rv = undefined;
                }
                break;
            case 'startTimeUnixNano':
            case 'endTimeUnixNano':
                // OTLP/gRPC time fields are `Long` (https://github.com/dcodeIO/Long.js),
                // converted to a plain object. Convert them to a string to
                // match the other flavour.
                if (typeof v === 'object' && 'low' in v) {
                    rv = new Long(v.low, v.high, v.unsigned).toString();
                }
                break;
        }
        return rv;
    };

    let norm;
    if (typeof metrics.constructor.toObject === 'function') {
        // Normalize `ExportMetricsServiceRequest` from OTLP/proto request
        // with our custom options.
        norm = metrics.constructor.toObject(metrics, {
            longs: String,
            json: true, // TODO not sure about using this, b/c it differs from other flavours
        });
    } else {
        norm = metrics;
    }

    return JSON.stringify(norm, replacer, opts.indent || 0);
}

/**
 * Normalize the given raw MetricsServiceRequest.
 *
 * See `jsonStringifyMetrics()` for full notes.
 */
function normalizeMetrics(rawMetrics) {
    const str = jsonStringifyMetrics(rawMetrics, {
        normAttributes: true,
    });
    return JSON.parse(str);
}

/**
 * JSON stringify an OTLP logs service request to one *possible* representation.
 *
 * This implementation:
 * - converts `timeUnixNano` and `observedTimeUnixNano` longs to string
 * - normalizes `body`, e.g. `"body": { "stringValue": "hi" },` becomes
 *   `"body": "hi"`.
 * - converts `traceId`, `spanId` to hex
 *
 * Limitations:
 * - We are using `json: true` for protobufjs conversion, which isn't applied
 *   for the other OTLP flavours.
 *
 * @param {any} logs
 * @param {object} opts
 * @param {number} [opts.indent] - indent option to pass to `JSON.stringify()`.
 * @param {boolean} [opts.normAttributes] - whether to convert 'attributes' to
 *      an object (rather than the native array of {key, value} objects).
 * @param {boolean} [opts.stripResource] - exclude the 'resource' property, for brevity.
 * @param {boolean} [opts.stripAttributes] - exclude 'attributes' properties, for brevity.
 * @param {boolean} [opts.stripScope] - exclude 'scope' property, for brevity.
 */
function jsonStringifyLogs(logs, opts) {
    const replacer = (k, v) => {
        let rv = v;
        switch (k) {
            case 'resource':
                if (opts.stripResource) {
                    rv = undefined;
                }
                break;
            case 'attributes':
                if (opts.stripAttributes) {
                    rv = undefined;
                } else if (opts.normAttributes) {
                    rv = {};
                    for (let i = 0; i < v.length; i++) {
                        const attr = v[i];
                        rv[attr.key] = normAttrValue(attr.value);
                    }
                }
                break;
            case 'scope':
                if (opts.stripScope) {
                    rv = undefined;
                }
                break;
            case 'body':
                rv = normAttrValue(v);
                break;
            case 'traceId':
            case 'spanId':
                // v.toJSON() will already have been called, converting it from
                // a Buffer to an object... which is just a waste of time.
                if (v.type === 'Buffer') {
                    rv = Buffer.from(v.data).toString('hex');
                }
                break;
            case 'timeUnixNano':
            case 'observedTimeUnixNano':
                // OTLP/gRPC time fields are `Long` (https://github.com/dcodeIO/Long.js),
                // converted to a plain object. Convert them to a string to
                // match the other flavour.
                if (typeof v === 'object' && 'low' in v) {
                    rv = new Long(v.low, v.high, v.unsigned).toString();
                }
                break;
        }
        return rv;
    };

    let norm;
    if (typeof logs.constructor.toObject === 'function') {
        // Normalize `ExportLogsServiceRequest` from OTLP/proto request
        // with our custom options.
        norm = logs.constructor.toObject(logs, {
            longs: String,
            json: true, // TODO not sure about using this, b/c it differs from other flavours
        });
    } else {
        norm = logs;
    }

    return JSON.stringify(norm, replacer, opts.indent || 0);
}

/**
 * Normalize the given raw LogsServiceRequest.
 *
 * See `jsonStringifyLogs()` for full notes.
 */
function normalizeLogs(rawLogs) {
    const str = jsonStringifyLogs(rawLogs, {
        normAttributes: true,
    });
    return JSON.parse(str);
}

module.exports = {
    jsonStringifyTrace,
    normalizeTrace,
    jsonStringifyMetrics,
    normalizeMetrics,
    jsonStringifyLogs,
    normalizeLogs,
};
