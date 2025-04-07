/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/** @type {NodeJS.ProcessEnv} */
const envToRestore = {};

/**
 * Tweak `process.env` before calling NodeSDK.
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
 * Restores any `process.env` stashed in `setupEnvironment()`.
 */
function restoreEnvironment() {
    Object.keys(envToRestore).forEach((k) => {
        process.env[k] = envToRestore[k];
        delete envToRestore[k];
    });
}

module.exports = {
    setupEnvironment,
    restoreEnvironment,
};
