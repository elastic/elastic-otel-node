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
const {gcpDetector} = require('@opentelemetry/resource-detector-gcp');
const {
    envDetectorSync,
    hostDetectorSync,
    processDetectorSync,
    Resource,
} = require('@opentelemetry/resources');
const { log } = require('./logging');

// @ts-ignore - compiler options do not allow lookp outside `lib` folder
const ELASTIC_SDK_VERSION = require('../package.json').version;

/** @type {Record<string, DetectorSync | Array<DetectorSync>>} */
const defaultDetectors = {
    // Elastic's own detector to add distro related metadata
    distro: {
        detect() {
            // TODO: change to semconv resource attribs when
            // `@opentelemetry/semantic-conventions` gets updated with the attribs used
            // https://github.com/open-telemetry/opentelemetry-js/issues/4235
            return new Resource({
                'telemetry.distro.name': 'elastic',
                'telemetry.distro.version': ELASTIC_SDK_VERSION,
            });
        }
    },
    env: envDetectorSync,
    process: processDetectorSync,
    // hostDetectorSync is not currently in the OTel default, but may be added
    host: hostDetectorSync,
    // cloud detectors
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
 * @returns {Array<DetectorSync>}
 */
function getDetectors() {
    const detectorsFromEnv =
        process.env['OTEL_NODE_RESOURCE_DETECTORS'] || 'all';

    if (detectorsFromEnv === 'none') {
        return [];
    }

    // XXX: by using `defaultDetectors` as a map it impicitly adds a new possible value which is
    // not in https://opentelemetry.io/docs/zero-code/js/configuration/
    // this value is `distro` and if used in the env var it will include our distro detector
    // ```
    // OTEL_NODE_RESOURCE_DETECTORS=distro,env,host,aws node ./app.js
    // ```
    const detectorKeys =
        detectorsFromEnv === 'all'
            ? Object.keys(defaultDetectors)
            : detectorsFromEnv.split(',');
    const detectors = [];

    for (const key of detectorKeys) {
        if (defaultDetectors[key]) {
            detectors.push(defaultDetectors[key]);
        } else {
            // XXX: warning instead of error? @opentelemetry/auto-instrumentations-node use error
            log.error(`Invalid resource detector "${key}" specified in the environment variable OTEL_NODE_RESOURCE_DETECTORS`)
        }
    }
    return detectors.flat();
}

module.exports = {
    getDetectors,
};
