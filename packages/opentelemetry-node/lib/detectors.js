/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @typedef {import('@opentelemetry/resources').ResourceDetector} ResourceDetector
 */

const {URL} = require('url');

const {getStringListFromEnv, suppressTracing} = require('@opentelemetry/core');
const {context} = require('@opentelemetry/api');

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
const {
    CLOUDPROVIDERVALUES_GCP,
    SEMRESATTRS_CLOUD_ACCOUNT_ID,
    SEMRESATTRS_CLOUD_AVAILABILITY_ZONE,
    SEMRESATTRS_CLOUD_PROVIDER,
    SEMRESATTRS_CONTAINER_NAME,
    SEMRESATTRS_HOST_ID,
    SEMRESATTRS_HOST_NAME,
    SEMRESATTRS_K8S_NAMESPACE_NAME,
    SEMRESATTRS_K8S_POD_NAME,
} = require('@opentelemetry/semantic-conventions');
const jsonBigint = require('json-bigint');

const {log} = require('./logging');

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

// TODO: Switch back to `@opentelemetry/resource-detector-gcp` when
// https://github.com/open-telemetry/opentelemetry-js-contrib/issues/2320 is complete
/** @type {ResourceDetector} */
const gcpDetector = {
    detect() {
        const baseUrl = new URL('/', 'http://metadata.google.internal:80');
        const metadataUrl = baseUrl + 'computeMetadata/v1/?recursive=true';
        const options = {
            method: 'GET',
            headers: {'Metadata-Flavor': 'Google'},
            signal: AbortSignal.timeout(1000),
        };

        const metadataPromise = context.with(
            suppressTracing(context.active()),
            () =>
                fetch(metadataUrl, options)
                    .then((res) => res.text())
                    .then((txt) => jsonBigint.parse(txt))
                    .catch((err) => {
                        log.debug({err}, 'Unable to get GCP metadata');
                        return undefined;
                    })
        );

        const attributes = {
            [SEMRESATTRS_CLOUD_PROVIDER]: metadataPromise.then(
                (md) => md && CLOUDPROVIDERVALUES_GCP
            ),
            [SEMRESATTRS_CLOUD_ACCOUNT_ID]: metadataPromise.then(
                (md) => md?.project?.projectId
            ),
            [SEMRESATTRS_HOST_ID]: metadataPromise.then(
                (md) => md?.instance?.id
            ),
            [SEMRESATTRS_HOST_NAME]: metadataPromise.then(
                (md) => md?.instance?.hostname
            ),
            [SEMRESATTRS_CLOUD_AVAILABILITY_ZONE]: metadataPromise.then(
                (md) => md?.zone
            ),
        };

        // Add resource attributes for K8s.
        // ref: https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/detectors/node/opentelemetry-resource-detector-gcp/src/detectors/GcpDetector.ts#L69-L80
        if (process.env.KUBERNETES_SERVICE_HOST) {
            // NOTE: haven't found the property in my tests, skipping
            // attributes[SEMRESATTRS_K8S_CLUSTER_NAME]
            attributes[SEMRESATTRS_K8S_NAMESPACE_NAME] = metadataPromise.then(
                (md) => md && process.env.NAMESPACE
            );
            attributes[SEMRESATTRS_K8S_POD_NAME] = metadataPromise.then(
                (md) => md && process.env.HOSTNAME
            );
            attributes[SEMRESATTRS_CONTAINER_NAME] = metadataPromise.then(
                (md) => md && process.env.CONTAINER_NAME
            );
        }
        return {attributes};
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
    azure: [azureAppServiceDetector, azureFunctionsDetector, azureVmDetector],
    gcp: gcpDetector,
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
