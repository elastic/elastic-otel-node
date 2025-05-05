/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {KeyValueSchema} = require('../lib/generated/anyvalue_pb');
const {create} = require('@bufbuild/protobuf');

/**
 * @typedef {import('./generated/anyvalue_pb.js').KeyValue} KeyValue
 */

/**
 * (Copied from "packages/opamp-client-node/".)
 *
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
 * (Copied from "packages/opamp-client-node/".)
 *
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

module.exports = {
    keyValuesFromObj,
};
