/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @typedef {import('./generated/anyvalue_pb.js').AnyValue} AnyValue
 * @typedef {import('./generated/anyvalue_pb.js').KeyValue} KeyValue
 */

/**
 * (Copied from "packages/opamp-client-node/lib/utils.js".)
 *
 * Convert a `KeyValue[]` type to a JS object.
 * For example, AgentDescription.identifying_attributes are of type `KeyValue[]`.
 * Using that type directly is a huge PITA.
 *
 * @param {KeyValue[]}
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
 * @param {AnyValue}
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

module.exports = {
    objFromKeyValues,
    isEqualUint8Array,
};
