/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {
    createOpAMPClient,
    AgentCapabilities,
    RemoteConfigStatuses,
} = require('@elastic/opamp-client-node');
const {ATTR_SERVICE_NAME} = require('@opentelemetry/semantic-conventions');

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
const LUGGITE_LEVEL_FROM_LOGGING_LEVEL = {
    off: luggite.FATAL + 1, // TODO: support 'silent'  or 'off' luggite level
    fatal: 'fatal',
    error: 'error',
    warn: 'warn',
    info: 'info',
    debug: 'debug',
    trace: 'trace',
};
const LOGGING_LEVEL_FROM_LUGGITE_LEVEL = {};
Object.keys(LUGGITE_LEVEL_FROM_LOGGING_LEVEL).forEach(function (name) {
    LOGGING_LEVEL_FROM_LUGGITE_LEVEL[LUGGITE_LEVEL_FROM_LOGGING_LEVEL[name]] =
        name;
});

/**
 * A "setter" is a function that applies the given config `val`.
 *
 * - A `val` of `undefined` means that the setting should be reset to its default value.
 * - After setting the value: `log.info('central-config: ...')`
 * - If there is an error applying the value, an error message string must be returned.
 *
 * @type Record<string, (any) => string | null>
 */
const SETTER_FROM_REMOTE_CONFIG_KEY = {
    logging_level: (val) => {
        let verb = 'set';
        if (val === undefined) {
            val = initialConfig.logging_level;
            verb = 'reset';
        }
        const luggiteLevel = LUGGITE_LEVEL_FROM_LOGGING_LEVEL[val];
        if (luggiteLevel) {
            log.level(luggiteLevel);
            log.info(`central-config: ${verb} "logging_level" to "${val}"`);
        } else {
            return `unknown 'logging_level' value: ${JSON.stringify(val)}`;
        }
        return null;
    },
};

/**
 * Apply the `remoteConfig` received from the OpAMP server and
 * `.setRemoteConfigStatus(...)` as appropriate.
 */
function onRemoteConfig(opampClient, remoteConfig) {
    console.log('XXX remoteConfig:');
    console.dir(remoteConfig, {depth: 50}); // XXX
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
        const config = JSON.parse(
            Buffer.from(agentConfigFile.body).toString('utf8')
        );
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
        for (let [key, setter] of Object.entries(
            SETTER_FROM_REMOTE_CONFIG_KEY
        )) {
            configKeys.delete(key);
            const currVal = lastAppliedConfig[key];
            const val = config[key];
            if (currVal !== val) {
                const errMsg = setter(val);
                if (errMsg) {
                    applyErrs.push(errMsg);
                } else {
                    appliedKeys.push(key);
                    lastAppliedConfig[key] = val;
                }
            }
        }
        for (let key of configKeys.values()) {
            applyErrs.push(`config name "${key}" is unsupported`);
        }

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
        log.warn(err, 'could not apply remoteConfig');
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
 * @returns {object | null} OpAMPClient, if configured to use one.
 */
function setupCentralConfig(resource) {
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
        if (isNaN(heartbeatIntervalSeconds)) {
            log.warn(
                `invalid ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL: using default`
            );
            heartbeatIntervalSeconds = undefined;
        }
    }

    // Gather initial effective config.
    initialConfig.logging_level =
        LOGGING_LEVEL_FROM_LUGGITE_LEVEL[
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
                onRemoteConfig(client, remoteConfig);
            }
        },
    });

    // Dev Note: The OpAMP spec recommends more attribute be included in
    // AgentDescription for "standalone running Agents":
    //     https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#agentdescription-message
    // We could consider more, but currently Elastic's OpAMP server only uses
    // `service.name` and `deployment.environment.name`.
    client.setAgentDescription({
        identifyingAttributes: {
            [ATTR_SERVICE_NAME]: resource.attributes[ATTR_SERVICE_NAME],
            [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
                resource.attributes[ATTR_DEPLOYMENT_ENVIRONMENT_NAME] ||
                resource.attributes[ATTR_DEPLOYMENT_NAME],
        },
    });
    // TODO: handle and test for a custom resource detector that does these *async*.

    client.start();

    return client;
}

module.exports = {
    setupCentralConfig,
};
