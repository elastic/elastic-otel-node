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

const {getEnv} = require('@opentelemetry/core');

/** @type {NodeJS.ProcessEnv} */
const envToRestore = {};

/**
 * Returns an array of strings from the given input. If undefined returns the fallback
 * value.
 * @param {string | undefined} str
 * @param {string[]} [fallback=[]]
 * @returns {string[]}
 */
function parseStringList(str, fallback = []) {
    if (!str) {
        return fallback;
    }
    return str.split(',').map((s) => s.trim());
}

/**
 * Returns a boolean from te given input
 * @param {string | undefined} str
 * @param {boolean} fallback
 * @returns {boolean}
 */
function parseBoolean(str, fallback) {
    if (!str) {
        return fallback;
    }
    return str.toLowerCase() === 'true';
}

/**
 * Returns a boolean from te given input
 * @param {string | undefined} str
 * @param {number} fallback
 * @returns {number}
 */
function parseNumber(str, fallback) {
    if (!str) {
        return fallback;
    }

    const num = Number(str);
    return isNaN(num) ? fallback : num;
}

/**
 * This funtion makes necessari changes to the environment so:
 * - Avoid OTEL's NodeSDK known warnings (eg. OTEL_TRACES_EXPORTER not set)
 * - Fix some issues not solved yet in OTEL (https://github.com/open-telemetry/opentelemetry-js/issues/4447)
 * - Others ...
 */
function setupEnvironment() {
    if (!('OTEL_TRACES_EXPORTER' in process.env)) {
        // Ensure this envvar is set to avoid a diag.warn() in NodeSDK.
        process.env.OTEL_TRACES_EXPORTER = 'otlp';
    }

    if ('OTEL_LOG_LEVEL' in process.env) {
        envToRestore['OTEL_LOG_LEVEL'] = process.env.OTEL_LOG_LEVEL;
        // Make sure NodeSDK doesn't see this envvar and overwrite our diag
        // logger. It is restored below.
        delete process.env.OTEL_LOG_LEVEL;
    }
    if ('OTEL_NODE_RESOURCE_DETECTORS' in process.env) {
        envToRestore['OTEL_NODE_RESOURCE_DETECTORS'] =
            process.env.OTEL_NODE_RESOURCE_DETECTORS;
        // Make sure NodeSDK doesn't see this envvar and logs some false errors
        // about detectors. It is restored below.
        // Ref: https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/opentelemetry-sdk-node/src/utils.ts#L35-L41
        delete process.env.OTEL_NODE_RESOURCE_DETECTORS;
    }
}

/**
 * Restores any value stashed in the setup process
 */
function restoreEnvironment() {
    Object.keys(envToRestore).forEach((k) => {
        process.env[k] = envToRestore[k];
    });
}

/**
 * @typedef {import('@opentelemetry/core').ENVIRONMENT} OtelEnv
 */
/**
 * @typedef {Object} EdotEnv
 * @property {string[]} OTEL_NODE_RESOURCE_DETECTORS
 * @property {number} OTEL_METRIC_EXPORT_INTERVAL
 * @property {number} OTEL_METRIC_EXPORT_TIMEOUT
 * @property {boolean} ELASTIC_OTEL_METRICS_DISABLED
 */
const otelEnv = getEnv();
/** @type {EdotEnv} */
const edotEnv = {
    // Missing OTEL_ vars from global spec and nodejs specific spec
    OTEL_NODE_RESOURCE_DETECTORS: parseStringList(
        process.env.OTEL_NODE_RESOURCE_DETECTORS,
        ['all']
    ),
    // Note: Default values has been taken from the specs
    // https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#periodic-exporting-metricreader
    OTEL_METRIC_EXPORT_INTERVAL: parseNumber(
        process.env.OTEL_METRIC_EXPORT_INTERVAL,
        60000
    ),
    OTEL_METRIC_EXPORT_TIMEOUT: parseNumber(
        process.env.OTEL_METRIC_EXPORT_TIMEOUT,
        30000
    ),
    // ELASTIC_OTEL_ vars
    ELASTIC_OTEL_METRICS_DISABLED: parseBoolean(
        process.env.ELASTIC_OTEL_METRICS_DISABLED,
        false
    ),
};

/**
 * @template {keyof OtelEnv | keyof EdotEnv} T
 * Returns the value of the env var already parsed to the proper type. If
 * the variable is not defined it will return the dafault value based on
 * the environmment variables spec https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/
 * @param {T} name
 * @returns {T extends keyof OtelEnv ? OtelEnv[T] : EdotEnv[T]}
 */
function getEnvVar(name) {
    if (name in otelEnv) {
        // @ts-ignore -- T is {keyof OtelEnv} but not sure how to make TS infer that
        return otelEnv[name];
    }

    // @ts-ignore -- T is {keyof EdotEnv} but not sure how to make TS infer that
    return edotEnv[name];
}

module.exports = {
    setupEnvironment,
    restoreEnvironment,
    getEnvVar,
};
