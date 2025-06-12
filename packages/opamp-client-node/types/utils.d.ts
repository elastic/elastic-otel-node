export type KeyValue = import('./generated/anyvalue_pb.js').KeyValue;
export type AnyValue = import('./generated/anyvalue_pb.js').AnyValue;
/**
 * @typedef {import('./generated/anyvalue_pb.js').KeyValue} KeyValue
 * @typedef {import('./generated/anyvalue_pb.js').AnyValue} AnyValue
 */
export function jitter(val: any): any;
export function isEqualUint8Array(a: any, b: any): boolean;
/**
 * Convert a JS object to the `KeyValue[]` type.
 *
 * @returns {KeyValue[]}
 */
export function keyValuesFromObj(obj: any): KeyValue[];
/**
 * Convert a `KeyValue[]` type to a JS object.
 * For example, AgentDescription.identifying_attributes are of type `KeyValue[]`.
 * Using that type directly is a huge PITA.
 *
 * @param {KeyValue[]} keyValues
 * @returns {object}
 */
export function objFromKeyValues(keyValues: KeyValue[]): object;
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
export function msFromRetryAfterHeader(header: string | undefined): number;
/**
 * Handle a retry-after value from a
 * ServerErrorResponse.Details.value.retryAfterNanoseconds.
 */
export function msFromRetryAfterNs(ns: any): number;
