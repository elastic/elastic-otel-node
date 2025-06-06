/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const assert = require('assert');

const {create} = require('@bufbuild/protobuf');

const {KeyValueSchema} = require('./generated/anyvalue_pb');

/**
 * @typedef {import('./generated/anyvalue_pb.js').KeyValue} KeyValue
 * @typedef {import('./generated/anyvalue_pb.js').AnyValue} AnyValue
 */

// Randomly adjust to given numeric value by +/- 10%.
function jitter(val) {
    assert.equal(typeof val, 'number');
    const range = val * 0.1; // +/- 10% jitter
    const jit = range * 2 * Math.random() - range;
    return val + jit;
}

function isEqualUint8Array(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

/**
 * Convert a JS object to the `KeyValue[]` type.
 *
 * @returns {KeyValue[]}
 */
function keyValuesFromObj(obj) {
    const keyValues = [];
    if (obj == null) {
        return keyValues;
    }

    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const val = obj[key];
        if (val !== undefined) {
            keyValues.push(
                create(KeyValueSchema, {key: key, value: anyValueFromVal(val)})
            );
        }
    }

    return keyValues;
}

/**
 * Convert a JS value `val` into the `MessageInit<AnyValue>` that makes
 * @bufbuild/protobuf happy.
 *
 * Dev Note: this *would* JSDoc `returns {Partial<AnyValue>}` but I cannot
 * get that to work with ArrayValue and KeyValueList.
 */
function anyValueFromVal(val) {
    const typ = typeof val;

    // Dev Note: Compare to `toAnyValue` in opentelemetry-js/experimental/packages/otlp-transformer/src/common/internal.ts.
    if (typ === 'string') {
        return {value: {value: val, case: 'stringValue'}};
    } else if (typ === 'number') {
        // Note: otlp-transformer uses `intValue` if Number.isInteger(val).
        // However protobufjs and bufbuild differ in how they represent the
        // protobuf `int64` type in their JS bindings, so `intValue` isn't
        // necessarily correct here. Using `intValue` results in getting a
        // BigInt on the other side. That is surprising.
        return {value: {value: val, case: 'doubleValue'}};
    } else if (typ === 'boolean') {
        return {value: {value: val, case: 'boolValue'}};
    } else if (typ === 'bigint') {
        return {value: {value: val, case: 'intValue'}};
    } else if (val instanceof Uint8Array) {
        return {value: {value: val, case: 'bytesValue'}};
    } else if (Array.isArray(val)) {
        return {
            value: {
                case: 'arrayValue',
                value: {values: val.map(anyValueFromVal)},
            },
        };
    } else if (typ === 'object' && val != null) {
        const values = [];
        const valKeys = Object.keys(val);
        for (let i = 0; i < valKeys.length; i++) {
            const k = valKeys[i];
            values.push({key: k, value: anyValueFromVal(val[k])});
        }
        return {
            value: {
                case: 'kvlistValue',
                value: {values},
            },
        };
    } else {
        return {}; // current repr for null, undefined, and unknown types
    }
}

/**
 * Convert a `KeyValue[]` type to a JS object.
 * For example, AgentDescription.identifying_attributes are of type `KeyValue[]`.
 * Using that type directly is a huge PITA.
 *
 * @param {KeyValue[]} keyValues
 * @returns {object}
 */
function objFromKeyValues(keyValues) {
    const obj = {};
    if (keyValues == null) {
        return obj;
    }
    for (let i = 0; i < keyValues.length; i++) {
        const kv = keyValues[i];
        obj[kv.key] = valFromAnyValue(kv.value);
    }
    return obj;
}

/**
 * @param {AnyValue} anyValue
 * @returns {any}
 */
function valFromAnyValue(anyValue) {
    let val;
    switch (anyValue.value.case) {
        case 'stringValue':
        case 'boolValue':
        case 'doubleValue':
        case 'bytesValue':
            val = anyValue.value.value;
            break;
        case 'intValue':
            val = anyValue.value.value;
            break;
        case 'arrayValue':
            val = anyValue.value.value.values.map(valFromAnyValue);
            break;
        case 'kvlistValue':
            val = objFromKeyValues(anyValue.value.value.values);
            break;
        // default: val is undefined
    }
    return val;
}

/**
 * Parse a Retry-After HTTP header to a number of milliseconds.
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After
 *
 * This clamps to [30s, 1d], and defaults to 5 minutes if the value is not
 * given or is invalid. The 30s value is from
 * https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#plain-http-transport-2
 * which says "The minimum recommended retry interval is 30 seconds."
 *
 * @param {string | undefined} header
 * @returns {number}
 */
function msFromRetryAfterHeader(header) {
    if (!header) {
        return DEFAULT_RETRY_AFTER_MS;
    }
    let retryAfterMs;
    if (RETRY_AFTER_SECONDS_RE.test(header)) {
        retryAfterMs = Number(header) * 1000;
    } else {
        retryAfterMs = new Date(header).getTime() - Date.now();
    }
    if (isNaN(retryAfterMs) || retryAfterMs < 0) {
        return DEFAULT_RETRY_AFTER_MS;
    }
    return Math.min(
        MAX_RETRY_AFTER_MS,
        Math.max(MIN_RETRY_AFTER_MS, retryAfterMs)
    );
}
const RETRY_AFTER_SECONDS_RE = /^\d+$/;
const MIN_RETRY_AFTER_MS = 30 * 1000;
const DEFAULT_RETRY_AFTER_MS = 5 * 60 * 1000;
const MAX_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Handle a retry-after value from a
 * ServerErrorResponse.Details.value.retryAfterNanoseconds.
 */
function msFromRetryAfterNs(ns) {
    if (ns > Number.MAX_SAFE_INTEGER) {
        return DEFAULT_RETRY_AFTER_MS;
    }
    const retryAfterMs = Number(ns / BigInt(1e6));
    return Math.min(
        MAX_RETRY_AFTER_MS,
        Math.max(MIN_RETRY_AFTER_MS, retryAfterMs)
    );
}

module.exports = {
    jitter,
    isEqualUint8Array,
    keyValuesFromObj,
    objFromKeyValues,
    msFromRetryAfterHeader,
    msFromRetryAfterNs,
};
