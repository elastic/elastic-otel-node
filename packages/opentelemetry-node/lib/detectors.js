/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NOTE: when `Detector` is finally removed import only `DetectorSync` and
 * get rid of the aliasing
 * @typedef {import('@opentelemetry/resources').Detector} DetectorOrig
 * @typedef {import('@opentelemetry/resources').DetectorSync} DetectorSyncOrig
 * @typedef {DetectorOrig | DetectorSyncOrig} DetectorSync
 */

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
const {gcpDetector} = require('@opentelemetry/resource-detector-gcp');
const {
    envDetectorSync,
    hostDetectorSync,
    osDetectorSync,
    processDetectorSync,
    serviceInstanceIdDetectorSync,
    Resource,
} = require('@opentelemetry/resources');

const {getEnvVar} = require('./environment');
const {log} = require('./logging');

// @ts-ignore - compiler options do not allow lookp outside `lib` folder
const ELASTIC_SDK_VERSION = require('../package.json').version;

// Elastic's own detector to add distro related metadata
/** @type {DetectorSync} */
const distroDetectorSync = {
    detect() {
        // TODO: change to semconv resource attribs when
        // `@opentelemetry/semantic-conventions` gets updated with the attribs used
        // https://github.com/open-telemetry/opentelemetry-js/issues/4235
        return new Resource({
            'telemetry.distro.name': 'elastic',
            'telemetry.distro.version': ELASTIC_SDK_VERSION,
        });
    },
};

/** @type {Record<string, DetectorSync | Array<DetectorSync>>} */
const defaultDetectors = {
    env: envDetectorSync,
    process: processDetectorSync,
    serviceinstance: serviceInstanceIdDetectorSync,
    os: osDetectorSync,
    host: hostDetectorSync,
    container: containerDetector,
    alibaba: alibabaCloudEcsDetector,
    aws: [
        awsBeanstalkDetector,
        awsEc2Detector,
        awsEcsDetector,
        awsEksDetector,
        awsLambdaDetector,
    ],
    azure: [azureAppServiceDetector, azureFunctionsDetector, azureVmDetector],
    gcp: gcpDetector,
};

/**
 * @param {Array<DetectorSync>} [detectors]
 * @returns {Array<DetectorSync>}
 */
function resolveDetectors(detectors) {
    if (detectors) {
        detectors.push(distroDetectorSync);
        return detectors;
    }

    let detectorKeys = getEnvVar('OTEL_NODE_RESOURCE_DETECTORS');
    if (detectorKeys.some((k) => k === 'all')) {
        detectorKeys = Object.keys(defaultDetectors);
    } else if (detectorKeys.some((k) => k === 'none')) {
        return [];
    }

    /** @type {Array<DetectorSync | DetectorSync[]>} */
    const resolvedDetectors = [distroDetectorSync];
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
