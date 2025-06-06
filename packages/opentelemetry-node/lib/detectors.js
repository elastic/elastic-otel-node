/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @typedef {import('@opentelemetry/resources').ResourceDetector} ResourceDetector
 */

const {getStringListFromEnv} = require('@opentelemetry/core');
const {
    alibabaCloudEcsDetector,
} = require('@opentelemetry/resource-detector-alibaba-cloud');
const {
    awsBeanstalkDetector,
    awsEcsDetector,
    awsEksDetector,
    awsEc2Detector,
    awsLambdaDetector,
} = require('@opentelemetry/resource-detector-aws');
const {
    azureAppServiceDetector,
    azureFunctionsDetector,
    azureVmDetector,
} = require('@opentelemetry/resource-detector-azure');
const {
    containerDetector,
} = require('@opentelemetry/resource-detector-container');
const {
    envDetector,
    hostDetector,
    osDetector,
    processDetector,
    serviceInstanceIdDetector,
} = require('@opentelemetry/resources');

const {log} = require('./logging');
const {gcpDetector} = require('./detector-gcp');

// @ts-ignore - compiler options do not allow lookp outside `lib` folder
const ELASTIC_SDK_VERSION = require('../package.json').version;

// Elastic's own detector to add distro related metadata
/** @type {ResourceDetector} */
const distroDetector = {
    detect() {
        // TODO: change to semconv resource attribs when
        // `@opentelemetry/semantic-conventions` gets updated with the attribs used
        // https://github.com/open-telemetry/opentelemetry-js/issues/4235
        return {
            attributes: {
                'telemetry.distro.name': 'elastic',
                'telemetry.distro.version': ELASTIC_SDK_VERSION,
            },
        };
    },
};

/** @type {Record<string, ResourceDetector | Array<ResourceDetector>>} */
const defaultDetectors = {
    env: envDetector,
    process: processDetector,
    serviceinstance: serviceInstanceIdDetector,
    os: osDetector,
    host: hostDetector,
    container: containerDetector,
    alibaba: alibabaCloudEcsDetector,
    aws: [
        awsBeanstalkDetector,
        awsEc2Detector,
        awsEcsDetector,
        awsEksDetector,
        awsLambdaDetector,
    ],
    // TODO: Switch back to `@opentelemetry/resource-detector-gcp` when
    // https://github.com/open-telemetry/opentelemetry-js-contrib/issues/2320 is complete
    gcp: gcpDetector,
    azure: [azureAppServiceDetector, azureFunctionsDetector, azureVmDetector],
};

/**
 * @param {Array<ResourceDetector>} [detectors]
 * @returns {Array<ResourceDetector>}
 */
function resolveDetectors(detectors) {
    if (detectors) {
        detectors.push(distroDetector);
        return detectors;
    }

    let detectorKeys = getStringListFromEnv('OTEL_NODE_RESOURCE_DETECTORS') || [
        'all',
    ];
    if (detectorKeys.some((k) => k === 'all')) {
        detectorKeys = Object.keys(defaultDetectors);
    } else if (detectorKeys.some((k) => k === 'none')) {
        return [];
    }

    // NOTE: Kibana is doing a breakdown by service instance when plotting the metrics dashboard. So it needs the instance ID.
    // Dashboard was added in https://github.com/elastic/kibana/pull/215735
    if (!detectorKeys.includes('serviceinstance')) {
        log.info(
            `The "serviceinstance" resource detector has not been selected. This will result in Kibana's APM Service Metrics dashboard not working. See https://www.elastic.co/docs/reference/opentelemetry/edot-sdks/nodejs/configuration.html#otel_node_resource_detectors-details`
        );
    }

    /** @type {Array<ResourceDetector | ResourceDetector[]>} */
    const resolvedDetectors = [distroDetector];
    for (const key of detectorKeys) {
        if (defaultDetectors[key]) {
            resolvedDetectors.push(defaultDetectors[key]);
        } else {
            log.warn(
                `Invalid resource detector "${key}" specified in the environment variable OTEL_NODE_RESOURCE_DETECTORS`
            );
        }
    }
    return resolvedDetectors.flat();
}

module.exports = {
    resolveDetectors,
};
