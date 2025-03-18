/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {
    getBooleanFromEnv,
    getNumberFromEnv,
    getStringListFromEnv,
    getStringFromEnv,
} = require('@opentelemetry/core');

/** @type {NodeJS.ProcessEnv} */
const envToRestore = {};

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
        delete envToRestore[k];
    });
}

/**
 * @template T
 * @param {(name: string) => T} getterFn
 * @returns {(name: string, defaultValue?: T) => T}
 */
function makeEnvVarGetter(getterFn) {
    return function (name, defaultValue = undefined) {
        const isStashed = name in envToRestore;
        let result;

        if (isStashed) {
            process.env[name] = envToRestore[name];
        }
        result = getterFn(name);
        if (isStashed) {
            delete process.env[name];
        }

        return typeof result === 'undefined' ? defaultValue : result;
    };
}

const getEnvBoolean = makeEnvVarGetter(getBooleanFromEnv);
const getEnvNumber = makeEnvVarGetter(getNumberFromEnv);
const getEnvString = makeEnvVarGetter(getStringFromEnv);
const getEnvStringList = makeEnvVarGetter(getStringListFromEnv);

module.exports = {
    setupEnvironment,
    restoreEnvironment,
    getEnvBoolean,
    getEnvNumber,
    getEnvString,
    getEnvStringList,
};
