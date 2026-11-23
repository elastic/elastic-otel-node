/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * This block is derived from https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-core/src/common/time.ts
 * License: Apache-2.0
 * Copyright The OpenTelemetry Authors
 */

const NANOSECOND_DIGITS = 9;
const NANOSECOND_DIGITS_IN_MILLIS = 6;
const MILLISECONDS_TO_NANOSECONDS = Math.pow(10, NANOSECOND_DIGITS_IN_MILLIS);

/**
 * Convert hrTime to timestamp, for example "2019-05-14T17:00:00.000123456Z"
 * @param {import('@opentelemetry/api').HrTime} time
 * @returns {string}
 */
function hrTimeToTimeStamp(time) {
    const precision = NANOSECOND_DIGITS;
    const tmp = `${'0'.repeat(precision)}${time[1]}Z`;
    const nanoString = tmp.substring(tmp.length - precision - 1);
    const date = new Date(time[0] * 1000).toISOString();
    return date.replace('000Z', nanoString);
}

/**
 * Converts a number of milliseconds from epoch to HrTime([seconds, remainder in nanoseconds]).
 * @param {number} epochMillis
 * @returns {import('@opentelemetry/api').HrTime}
 */
function millisToHrTime(epochMillis) {
    const epochSeconds = epochMillis / 1000;
    // Decimals only.
    const seconds = Math.trunc(epochSeconds);
    // Round sub-nanosecond accuracy to nanosecond.
    const nanos = Math.round(
        (epochMillis % 1000) * MILLISECONDS_TO_NANOSECONDS
    );
    return [seconds, nanos];
}

module.exports = {
    hrTimeToTimeStamp,
    millisToHrTime,
};
