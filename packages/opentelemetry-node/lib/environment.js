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

/**
 * Return an object with all `OTEL_` and `ELASTIC_OTEL_` envvars that are **safe
 * to be logged**. I.e. this redacts the value of any envvar not on the
 * allowlist of non-sensitive envvars.
 *
 * Compare to the equiv in EDOT Python:
 * https://github.com/elastic/elastic-otel-python/blob/v1.9.0/src/elasticotel/distro/config.py#L95-L104
 */
function getSafeEdotEnv() {
    // While more of a PITA to maintain, I'm opting for an allowlist of known
    // envvars with presumed non-sensitive values, to bias on the side of safer.
    const edotEnv = {};
    for (const k of Object.keys(process.env)) {
        if (k.startsWith('OTEL_') || k.startsWith('ELASTIC_OTEL_')) {
            if (NON_SENSTITIVE_EDOT_ENV_NAMES.has(k)) {
                edotEnv[k] = process.env[k];
            } else {
                edotEnv[k] = '[REDACTED]';
            }
        }
    }
    return edotEnv;
}

/**
 * A set of EDOT/OTel-related envvar names whose value is not considered
 * sensitive information. For example the `OTEL_EXPORTER_OTLP*_HEADERS` envvars
 * should NOT be included in this set.
 *
 * Command to grep the current repo (assumed to be elastic-otel-node.git)
 * and upstream OTel JS repos for candidates:
 *
        rg '\b((ELASTIC_)?OTEL_\w+)\b' -oIN \
            -g '*.{ts,js,mjs,cjs}' -g '!test' -g '!semantic-conventions' -g '!contrib-test-utils' \
            . ~/src/opentelemetry-js ~/src/opentelemetry-js-contrib \
            | rg -v '(^OTEL_EXPORTER_OTLP.*_HEADERS$|ELASTIC_OTEL_OPAMP_HEADERS|PASSWORD)' \
            | rg -v '(_SYMBOL|OTEL_SEV_NUM_FROM_|OTEL_FOO|OTEL_PATCHED_SYMBOL|OTEL_OPEN_SPANS|_$)' \
            | sort | uniq
 */
const NON_SENSTITIVE_EDOT_ENV_NAMES = new Set(`

    ELASTIC_OTEL_CONTEXT_PROPAGATION_ONLY
    ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL
    ELASTIC_OTEL_HOST_METRICS_DISABLED
    ELASTIC_OTEL_INSTRUMENTATION_HTTP_CLIENT_CAPTURE_REQUEST_HEADERS
    ELASTIC_OTEL_INSTRUMENTATION_HTTP_CLIENT_CAPTURE_RESPONSE_HEADERS
    ELASTIC_OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_REQUEST_HEADERS
    ELASTIC_OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_RESPONSE_HEADERS
    ELASTIC_OTEL_METRICS_DISABLED
    ELASTIC_OTEL_NODE_ENABLE_LOG_SENDING
    ELASTIC_OTEL_OPAMP_CERTIFICATE
    ELASTIC_OTEL_OPAMP_CLIENT_CERTIFICATE
    ELASTIC_OTEL_OPAMP_CLIENT_KEY
    ELASTIC_OTEL_OPAMP_ENDPOINT
    ELASTIC_OTEL_TEST_OPAMP_CLIENT_DIAG_ENABLED
    OTEL_ATTRIBUTE_COUNT_LIMIT
    OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT
    OTEL_BLRP_EXPORT_TIMEOUT
    OTEL_BLRP_MAX_EXPORT_BATCH_SIZE
    OTEL_BLRP_MAX_QUEUE_SIZE
    OTEL_BLRP_SCHEDULE_DELAY
    OTEL_BSP_EXPORT_TIMEOUT
    OTEL_BSP_MAX_EXPORT_BATCH_SIZE
    OTEL_BSP_MAX_QUEUE_SIZE
    OTEL_BSP_SCHEDULE_DELAY
    OTEL_EVENT_ATTRIBUTE_COUNT_LIMIT
    OTEL_EXPERIMENTAL_CONFIG_FILE
    OTEL_EXPORTER_JAEGER_AGENT_HOST
    OTEL_EXPORTER_JAEGER_AGENT_PORT
    OTEL_EXPORTER_JAEGER_ENDPOINT
    OTEL_EXPORTER_JAEGER_USER
    OTEL_EXPORTER_OTLP_CERTIFICATE
    OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE
    OTEL_EXPORTER_OTLP_CLIENT_KEY
    OTEL_EXPORTER_OTLP_COMPRESSION
    OTEL_EXPORTER_OTLP_ENDPOINT
    OTEL_EXPORTER_OTLP_INSECURE
    OTEL_EXPORTER_OTLP_LOGS_CERTIFICATE
    OTEL_EXPORTER_OTLP_LOGS_CLIENT_CERTIFICATE
    OTEL_EXPORTER_OTLP_LOGS_CLIENT_KEY
    OTEL_EXPORTER_OTLP_LOGS_COMPRESSION
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
    OTEL_EXPORTER_OTLP_LOGS_PROTOCOL
    OTEL_EXPORTER_OTLP_LOGS_TIMEOUT
    OTEL_EXPORTER_OTLP_METRICS_CERTIFICATE
    OTEL_EXPORTER_OTLP_METRICS_CLIENT_CERTIFICATE
    OTEL_EXPORTER_OTLP_METRICS_CLIENT_KEY
    OTEL_EXPORTER_OTLP_METRICS_COMPRESSION
    OTEL_EXPORTER_OTLP_METRICS_DEFAULT_HISTOGRAM_AGGREGATION
    OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
    OTEL_EXPORTER_OTLP_METRICS_PROTOCOL
    OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE
    OTEL_EXPORTER_OTLP_METRICS_TIMEOUT
    OTEL_EXPORTER_OTLP_PROTOCOL
    OTEL_EXPORTER_OTLP_TIMEOUT
    OTEL_EXPORTER_OTLP_TRACES_CERTIFICATE
    OTEL_EXPORTER_OTLP_TRACES_CLIENT_CERTIFICATE
    OTEL_EXPORTER_OTLP_TRACES_CLIENT_KEY
    OTEL_EXPORTER_OTLP_TRACES_COMPRESSION
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
    OTEL_EXPORTER_OTLP_TRACES_PROTOCOL
    OTEL_EXPORTER_OTLP_TRACES_TIMEOUT
    OTEL_EXPORTER_PROMETHEUS_HOST
    OTEL_EXPORTER_PROMETHEUS_PORT
    OTEL_EXPORTER_ZIPKIN_ENDPOINT
    OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT
    OTEL_INSTRUMENTATION_HTTP_KNOWN_METHODS
    OTEL_LINK_ATTRIBUTE_COUNT_LIMIT
    OTEL_LOG_LEVEL
    OTEL_LOGRECORD_ATTRIBUTE_COUNT_LIMIT
    OTEL_LOGRECORD_ATTRIBUTE_VALUE_LENGTH_LIMIT
    OTEL_LOGS_EXPORTER
    OTEL_METRIC_EXPORT_INTERVAL
    OTEL_METRIC_EXPORT_TIMEOUT
    OTEL_METRICS_EXEMPLAR_FILTER
    OTEL_METRICS_EXPORTER
    OTEL_NODE_DISABLED_INSTRUMENTATIONS
    OTEL_NODE_ENABLED_INSTRUMENTATIONS
    OTEL_NODE_RESOURCE_DETECTORS
    OTEL_PROPAGATORS
    OTEL_RESOURCE_ATTRIBUTES
    OTEL_SDK_DISABLED
    OTEL_SEMCONV_STABILITY_OPT_IN
    OTEL_SERVICE_NAME
    OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT
    OTEL_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT
    OTEL_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT
    OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT
    OTEL_SPAN_EVENT_COUNT_LIMIT
    OTEL_SPAN_LINK_COUNT_LIMIT
    OTEL_TRACES_EXPORTER
    OTEL_TRACES_SAMPLER
    OTEL_TRACES_SAMPLER_ARG

`
        .trim()
        .split(/\s+/)
);

module.exports = {
    setupEnvironment,
    restoreEnvironment,
    getSafeEdotEnv,
};
