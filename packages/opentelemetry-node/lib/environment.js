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

// @ts-ignore - compiler options do not allow lookp outside `lib` folder
const ELASTIC_SDK_VERSION = require('../package.json').version;
const OTEL_SDK_VERSION =
    require('@opentelemetry/sdk-node/package.json').version;
const USER_AGENT_PREFIX = `elastic-otel-node/${ELASTIC_SDK_VERSION}`;
const USER_AGENT_HEADER = `${USER_AGENT_PREFIX} OTel-OTLP-Exporter-JavaScript/${OTEL_SDK_VERSION}`;

/** @type {NodeJS.ProcessEnv} */
const envToRestore = {};

/**
 * Reads a string in the format `key-1=value,key2=value2` and parses
 * it into an object. This is the format specified for key value pairs
 * for OTEL environment vars. Example:
 * https://opentelemetry.io/docs/concepts/sdk-configuration/otlp-exporter-configuration/#otel_exporter_otlp_headers
 *
 * If the param is not defined or falsy it returns an empty object
 *
 * @param {string | undefined} str
 * @returns {Record<string, string>}
 */
function parseKeyValuePairs(str) {
    if (!str) {
        return {};
    }

    const pairs = str.split(',');

    return pairs.reduce((record, text) => {
        const sepIndex = text.indexOf('=');
        const key = text.substring(0, sepIndex);
        const val = text.substring(sepIndex + 1);

        record[key] = val;
        return record;
    }, {});
}

/**
 * Serializes an object to a string in the format `key-1=value,key2=value2`
 *
 * @param {Record<string, string>} pairs
 * @returns {string}
 */
function serializeKeyValuePairs(pairs) {
    return Object.entries(pairs)
        .map(([key, val]) => `${key}=${val}`)
        .join(',');
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

    // Work with exporter headers:
    // - Add our `user-agent` header in headers for traces, matrics & logs
    // - comply with OTEL_EXPORTER_OTLP_HEADERS spec until the issue is fixed
    // TODO: should we stash and restore? if so the restoration should be done
    // after start
    const userAgentHeader = {'User-Agent': USER_AGENT_HEADER};
    // TODO: for now we omit our user agent if already defined elsewhere
    const tracesHeaders = Object.assign(
        {},
        userAgentHeader,
        parseKeyValuePairs(process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS)
    );
    process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS =
        serializeKeyValuePairs(tracesHeaders);

    const metricsHeaders = Object.assign(
        {},
        userAgentHeader,
        parseKeyValuePairs(process.env.OTEL_EXPORTER_OTLP_METRICS_HEADERS)
    );
    process.env.OTEL_EXPORTER_OTLP_METRICS_HEADERS =
        serializeKeyValuePairs(metricsHeaders);

    const logsHeaders = Object.assign(
        {},
        userAgentHeader,
        parseKeyValuePairs(process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS)
    );
    process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS =
        serializeKeyValuePairs(logsHeaders);

    if ('OTEL_LOG_LEVEL' in process.env) {
        envToRestore['OTEL_LOG_LEVEL'] = process.env.OTEL_LOG_LEVEL;
        // Make sure NodeSDK doesn't see this envvar and overwrite our diag
        // logger. It is restored below.
        delete process.env.OTEL_LOG_LEVEL;
    }
    if ('OTEL_NODE_RESOURCE_DETECTORS' in process.env) {
        envToRestore['OTEL_NODE_RESOURCE_DETECTORS'] = process.env.OTEL_NODE_RESOURCE_DETECTORS;
        // Make sure NodeSDK doesn't see this envvar and logs some false errors
        // about detectors. It is restored below.
        // Ref: https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/opentelemetry-sdk-node/src/utils.ts#L35-L41
        delete process.env.OTEL_NODE_RESOURCE_DETECTORS;
    }
}

/**
 * Restores any value stashed in the stup process
 */
function restoreEnvironment() {
    Object.keys(envToRestore).forEach((k) => {
        process.env[k] = envToRestore[k];
    });
}

/**
 * Gets the env var value also checking in the vars pending to be restored
 * @param {string} name
 * @returns {string | undefined}
 */
function getEnvVar(name) {
    return process.env[name] || envToRestore[name];
}

module.exports = {
    setupEnvironment,
    restoreEnvironment,
    getEnvVar,
};
