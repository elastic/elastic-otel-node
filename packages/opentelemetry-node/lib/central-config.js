/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {
    createOpAMPClient,
    AgentCapabilities,
    RemoteConfigStatuses,
} = require('@elastic/opamp-client-node');
const {context} = require('@opentelemetry/api');
const {ATTR_SERVICE_NAME} = require('@opentelemetry/semantic-conventions');
const {getBooleanFromEnv, suppressTracing} = require('@opentelemetry/core');

const {
    ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
    ATTR_DEPLOYMENT_NAME,
} = require('./semconv');
const {log, DEFAULT_LOG_LEVEL} = require('./logging');
const luggite = require('./luggite');

// The key used in the AgentConfigMap.configMap for the Elastic central config
// AgentConfigFile.
const AGENT_CONFIG_MAP_KEY = 'elastic';

// The *initial* value of each supported central-config setting.
// Used for *resetting* values, e.g. when a central config setting is removed.
let initialConfig = {};
// The last value applied for each supported central-config setting.
let lastAppliedConfig = {};

/**
 * Mapping Elastic Observability's central config `logging_level` values to
 * those for this package's logger (`luggite`).
 * https://github.com/elastic/kibana/blob/main/x-pack/solutions/observability/plugins/apm/common/agent_configuration/runtime_types/logging_level_rt.ts
 */
const LUGGITE_LEVEL_FROM_CC_LOGGING_LEVEL = {
    off: luggite.FATAL + 1, // TODO: support 'silent'  or 'off' luggite level
    fatal: 'fatal',
    error: 'error',
    warn: 'warn',
    info: 'info',
    debug: 'debug',
    trace: 'trace',
};
const CC_LOGGING_LEVEL_FROM_LUGGITE_LEVEL = {};
Object.keys(LUGGITE_LEVEL_FROM_CC_LOGGING_LEVEL).forEach(function (name) {
    CC_LOGGING_LEVEL_FROM_LUGGITE_LEVEL[
        LUGGITE_LEVEL_FROM_CC_LOGGING_LEVEL[name]
    ] = name;
});

/**
 * A "setter" is a function that applies one or more config keys.
 *
 * - A config value of `undefined` means that the setting should be reset to its default value.
 * - After setting the value: `log.info('central-config: ...')`
 * - If there is an error applying the value, an error message string must be returned.
 *
 * @typedef {object} RemoteConfigHandler
 * @property {string[]} keys
 * @property {(config: any, _sdkInfo: any) => string | null} setter
 *
 */
/** @type {RemoteConfigHandler[]} */
const REMOTE_CONFIG_HANDLERS = [
    {
        keys: ['logging_level'],
        setter: (config, _sdkInfo) => {
            let val = config['logging_level'];
            let verb = 'set';
            if (val === undefined) {
                val = initialConfig.logging_level;
                verb = 'reset';
            }
            const luggiteLevel = LUGGITE_LEVEL_FROM_CC_LOGGING_LEVEL[val];
            if (luggiteLevel) {
                log.level(luggiteLevel);
                log.info(`central-config: ${verb} "logging_level" to "${val}"`);
            } else {
                return `unknown 'logging_level' value: ${JSON.stringify(val)}`;
            }
            return null;
        },
    },

    /**
     * How to dynamically enable/disable instrumentations.
     *
     * # The "right" way
     *
     * The OTel spec currently (2025-07) has "Development" phase
     * configuration plans that provide exactly what we'd need:
     * - TracerConfigurator (https://opentelemetry.io/docs/specs/otel/trace/sdk/#configuration)
     * - MeterConfigurator (https://opentelemetry.io/docs/specs/otel/metrics/sdk/#configuration),
     * - LoggerConfigurator (https://opentelemetry.io/docs/specs/otel/logs/sdk/#configuration)
     *
     * To *use* this with OTel SDK we will need:
     * - the API to add support for the "Enabled" API, e.g. https://opentelemetry.io/docs/specs/otel/trace/api/#enabled
     *   for tracing,
     * - the SDK packages (sdk-metrics et al) to implement the Configurators, and
     * - the instrumentations to use the new APIs to deactivate themselves when
     *   their tracer/meter/logger is disabled.
     *
     * This will take a while.
     *
     * # The workaround way
     *
     * For now, we'll use the following techniques to deactivate as best we can.
     *
     * For **tracing** we typically `instr.setTracerProvider(noop)`, after
     * which, any instrumentation will create `NonRecordingSpan`s which
     * effectively disables tracing.
     *
     * Note that there are `disable() / enable()` methods on the base
     * instrumentation class. However, for instrumentations that monkey-patch
     * libraries, disabling/enabling means unpatching and re-patching via the
     * RITM/IITM hooks. It is generally agreed by OTel JS maintainers that this
     * is not reliable: it doesn't work in all cases (user code with a ref to
     * patched function), ESM limitations.
     *
     * `instr.disable()` *is* a good mechanism for specific instrumentations
     * that don't use patching and do a good job guarding on whether they are
     * enabled (e.g. undici), and when usable, this also handles disabling
     * metrics.
     *
     * For **metrics**, the general mechanism is TBD.
     * (TODO: finish these docs, hope to use views)
     *
     * For **logs**, there is a difference between the "log correlation" and
     * "log sending" features, for example see
     * https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/packages/instrumentation-bunyan/README.md#usage
     * "log correlation" can be disabled via `instr.disable()`.
     *
     * Currently "log sending" cannot disabled this way, because an appender has
     * already been attached to a user's `Logger` object which has no connection
     * back to the instrumentation instance. It *might* be possible to always
     * install a `LogRecordProcessor` that dynamically drops logs for disabled
     * instrumentations. However this feels like a poor/heavy solution.
     * Suggestion: document the limitation and suggest usage of the eventual
     * `send_logs` central config setting.
     *
     * # Non-solutions
     *
     * Using `instr.setMeterProvider()` is not a solution. At least with
     * instr-runtime-node it results in creating *more* Instruments without
     * removing the old ones. The result is some metrics are still emitted *and*
     * there is a memleak.
     */
    {
        keys: ['deactivate_all_instrumentations'],
        setter: (config, sdkInfo) => {
            // Validate the given config value.
            let val = config['deactivate_all_instrumentations'];
            let verb = 'deactivated';
            if (val === undefined) {
                val = false;
                verb = 'reactivated';
            } else {
                switch (typeof val) {
                    case 'boolean':
                        // pass
                        break;
                    case 'string':
                        switch (val.trim().toLowerCase()) {
                            case 'true':
                                val = true;
                                break;
                            case 'false':
                                val = false;
                                break;
                            default:
                                return `unknown 'deactivate_all_instrumentations' value: ${JSON.stringify(
                                    val
                                )}`;
                        }
                        break;
                    default:
                        return `unknown 'deactivate_all_instrumentations' value type: ${typeof val} (${JSON.stringify(
                            val
                        )})`;
                }
            }

            // (De)activate instrumentations, as appropriate.
            for (let instr of sdkInfo.instrs) {
                switch (instr.instrumentationName) {
                    case '@opentelemetry/instrumentation-undici':
                    case '@opentelemetry/instrumentation-runtime-node':
                        // TODO: add and test the logger-related instrs
                        if (val) {
                            instr.disable();
                        } else {
                            instr.enable();
                        }
                        break;
                    default:
                        if (val) {
                            instr.setTracerProvider(sdkInfo.noopTracerProvider);
                        } else {
                            instr.setTracerProvider(sdkInfo.sdkTracerProvider);
                        }
                        break;
                }
            }
            log.info(`central-config: ${verb} all instrumentations`);

            return null;
        },
    },
];

/**
 * Apply the `remoteConfig` received from the OpAMP server and
 * `.setRemoteConfigStatus(...)` as appropriate.
 */
function onRemoteConfig(sdkInfo, opampClient, remoteConfig) {
    let configJson;
    try {
        // Validate the remote config.
        const agentConfigFile =
            remoteConfig.config.configMap[AGENT_CONFIG_MAP_KEY];
        if (!agentConfigFile) {
            // The remoteConfig does not include an entry in the configMap
            // for us. Nothing to do.
            log.debug(
                `remoteConfig configMap did not include "${AGENT_CONFIG_MAP_KEY}" key, other keys included: ${JSON.stringify(
                    Object.keys(remoteConfig.config.configMap)
                )}`
            );
            opampClient.setRemoteConfigStatus({
                lastRemoteConfigHash: remoteConfig.configHash,
                status: RemoteConfigStatuses.RemoteConfigStatuses_APPLIED,
            });
            return;
        }
        if (
            // Allow 'text/json' for older versions of apmconfig (OpAMP server).
            !['application/json', 'text/json'].includes(
                agentConfigFile.contentType
            )
        ) {
            throw new Error(
                `unexpected contentType for remoteConfig file: ${agentConfigFile.contentType}`
            );
        }
        configJson = Buffer.from(agentConfigFile.body).toString('utf8');
        const config = JSON.parse(configJson);
        log.debug({config}, 'received remoteConfig');
        if (typeof config !== 'object' || config == null) {
            throw new Error(
                `config is unexpectedly not a JSON object: type is ${typeof config}`
            );
        }

        // Apply the remote config.
        const appliedKeys = [];
        const applyErrs = [];
        const configKeys = new Set(Object.keys(config));
        for (const {keys, setter} of REMOTE_CONFIG_HANDLERS) {
            let valsChanged = false;
            for (const key of keys) {
                configKeys.delete(key);
                const currVal = lastAppliedConfig[key];
                const val = config[key];
                if (currVal !== val) {
                    valsChanged ||= true;
                }
            }
            if (valsChanged) {
                const errMsg = setter(config, sdkInfo);
                if (errMsg) {
                    applyErrs.push(errMsg);
                } else {
                    for (const key of keys) {
                        appliedKeys.push(key);
                        lastAppliedConfig[key] = config[key];
                    }
                }
            }
        }
        for (let key of configKeys.values()) {
            applyErrs.push(`config name "${key}" is unsupported`);
        }

        // Report config status.
        if (applyErrs.length > 0) {
            log.error(
                {config, applyErrs},
                'could not apply all remote config settings'
            );
            opampClient.setRemoteConfigStatus({
                lastRemoteConfigHash: remoteConfig.configHash,
                status: RemoteConfigStatuses.RemoteConfigStatuses_FAILED,
                errorMessage: `there were issues applying remote config: ${applyErrs.join(
                    ', '
                )}`,
            });
        } else {
            if (appliedKeys.length > 0 || Object.keys(config).length > 0) {
                log.info(
                    {config, appliedKeys},
                    'successfully applied remote config'
                );
            }
            opampClient.setRemoteConfigStatus({
                lastRemoteConfigHash: remoteConfig.configHash,
                status: RemoteConfigStatuses.RemoteConfigStatuses_APPLIED,
            });
        }
    } catch (err) {
        log.warn({err, configJson}, 'could not apply remoteConfig');
        opampClient.setRemoteConfigStatus({
            lastRemoteConfigHash: remoteConfig.configHash,
            status: RemoteConfigStatuses.RemoteConfigStatuses_FAILED,
            errorMessage: err.message,
        });
    }
}

/**
 * Setup an OpAMP client, if configured to use one.
 *
 * TODO: type for sdkInfo
 *
 * @returns {object | null} OpAMPClient, if configured to use one.
 */
function setupCentralConfig(sdkInfo) {
    if (!process.env.ELASTIC_OTEL_OPAMP_ENDPOINT) {
        return null;
    }

    let endpoint = process.env.ELASTIC_OTEL_OPAMP_ENDPOINT;
    if (
        !endpoint.toLowerCase().startsWith('http://') &&
        !endpoint.toLowerCase().startsWith('https://')
    ) {
        // 'localhost:4320' -> 'http://localhost:4320'
        endpoint = 'http://' + endpoint;
    }
    try {
        const u = new URL(endpoint);
        if (u.pathname === '/') {
            u.pathname = '/v1/opamp';
        }
        endpoint = u.href;
    } catch (endpointErr) {
        log.warn(
            `invalid ELASTIC_OTEL_OPAMP_ENDPOINT, '{endpoint}', OpAMP will not be configured`
        );
        return null;
    }

    // ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL, if given, is in *ms*
    // per https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#duration
    let heartbeatIntervalSeconds = undefined;
    if (process.env.ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL) {
        heartbeatIntervalSeconds =
            Number(
                process.env.ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL
            ) / 1000;
        if (isNaN(heartbeatIntervalSeconds) || heartbeatIntervalSeconds < 0) {
            log.warn(
                {
                    heartbeatIntervalSeconds:
                        process.env
                            .ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL,
                },
                `invalid ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL: using default`
            );
            heartbeatIntervalSeconds = undefined;
        }
    }

    // ELASTIC_OTEL_TEST_OPAMP_CLIENT_DIAG_ENABLED can be used to enable the
    // `diagEnabled` facility in opamp-client-node, intended for testing.
    const diagEnabled = getBooleanFromEnv(
        'ELASTIC_OTEL_TEST_OPAMP_CLIENT_DIAG_ENABLED'
    );

    // Gather initial effective config.
    initialConfig.logging_level =
        CC_LOGGING_LEVEL_FROM_LUGGITE_LEVEL[
            luggite.nameFromLevel[log.level()] ?? DEFAULT_LOG_LEVEL
        ];
    log.debug({initialConfig}, 'initial central config values');

    const client = createOpAMPClient({
        log,
        endpoint,
        heartbeatIntervalSeconds,
        capabilities: BigInt(
            // The `Number()` are hacks to make TypeScript type checking happy
            // in the face of the mushy type for protobuf enums. We know that
            // all `AgentCapabilities_*` properties are numbers.
            Number(AgentCapabilities.AgentCapabilities_AcceptsRemoteConfig) |
                Number(AgentCapabilities.AgentCapabilities_ReportsRemoteConfig)
        ),
        onMessage: ({remoteConfig}) => {
            if (remoteConfig) {
                onRemoteConfig(sdkInfo, client, remoteConfig);
            }
        },
        diagEnabled,
    });

    // Dev Note: The OpAMP spec recommends more attribute be included in
    // AgentDescription for "standalone running Agents":
    //     https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#agentdescription-message
    // We could consider more, but currently Elastic's OpAMP server only uses
    // `service.name` and `deployment.environment.name`.
    client.setAgentDescription({
        identifyingAttributes: {
            [ATTR_SERVICE_NAME]: sdkInfo.resource.attributes[ATTR_SERVICE_NAME],
            [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
                sdkInfo.resource.attributes[ATTR_DEPLOYMENT_ENVIRONMENT_NAME] ||
                sdkInfo.resource.attributes[ATTR_DEPLOYMENT_NAME],
        },
    });
    // TODO: handle and test for a custom resource detector that does these *async*.

    // Suppress tracing of HTTP calls made by the OpAMP client.
    context.with(suppressTracing(context.active()), () => {
        client.start();
    });

    return client;
}

module.exports = {
    setupCentralConfig,
};
