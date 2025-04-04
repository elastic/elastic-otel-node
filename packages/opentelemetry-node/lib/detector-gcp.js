/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @typedef {import('@opentelemetry/resources').ResourceDetector} ResourceDetector
 */

const { URL } = require('url');

const { suppressTracing } = require('@opentelemetry/core');
const { context } = require('@opentelemetry/api');
const {
    CLOUDPROVIDERVALUES_GCP,
    SEMRESATTRS_CLOUD_ACCOUNT_ID,
    SEMRESATTRS_CLOUD_AVAILABILITY_ZONE,
    SEMRESATTRS_CLOUD_PROVIDER,
    SEMRESATTRS_CONTAINER_NAME,
    SEMRESATTRS_HOST_ID,
    SEMRESATTRS_HOST_NAME,
    SEMRESATTRS_K8S_CLUSTER_NAME,
    SEMRESATTRS_K8S_NAMESPACE_NAME,
    SEMRESATTRS_K8S_POD_NAME,
} = require('@opentelemetry/semantic-conventions');

// TODO: Switch back to `@opentelemetry/resource-detector-gcp` when
// https://github.com/open-telemetry/opentelemetry-js-contrib/issues/2320 is complete
/** @type {ResourceDetector} */
const gcpDetector = {
    detect() {
        const metadataPromise = context.with(
            suppressTracing(context.active()),
            async () => {
                const available = await isAvailable();
                if (!available) {
                    return undefined;
                }
                return {
                    'projectId': metadataQuery('project/project-id').catch(() => ''),
                    'instanceId': metadataQuery('instance/id').catch(() => ''),
                    'zoneId': metadataQuery('instance/zone').catch(() => ''),
                    'clusterName': metadataQuery('instance/attributes/cluster-name').catch(() => ''),
                    'hostname': metadataQuery('instance/hostname').catch(() => ''),
                };
            }
        );

        const attributes = {
            [SEMRESATTRS_CLOUD_PROVIDER]: metadataPromise.then(
                (md) => md && CLOUDPROVIDERVALUES_GCP
            ),
            [SEMRESATTRS_CLOUD_ACCOUNT_ID]: metadataPromise.then(
                (md) => md?.projectId
            ),
            [SEMRESATTRS_HOST_ID]: metadataPromise.then(
                (md) => md?.instanceId
            ),
            [SEMRESATTRS_HOST_NAME]: metadataPromise.then(
                (md) => md?.hostname
            ),
            [SEMRESATTRS_CLOUD_AVAILABILITY_ZONE]: metadataPromise.then(
                (md) => md?.zoneId
            ),
        };

        // Add resource attributes for K8s.
        // ref: https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/detectors/node/opentelemetry-resource-detector-gcp/src/detectors/GcpDetector.ts#L69-L80
        if (process.env.KUBERNETES_SERVICE_HOST) {
            attributes[SEMRESATTRS_K8S_CLUSTER_NAME] = metadataPromise.then(
                (md) => md?.clusterName
            );
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
        return { attributes };
    },
};

/**
 * @returns {Promise<boolean>}
 */
function isAvailable() {
    return metadataQuery('instance').then(() => true).catch(() => false);
}

/**
 * Returns the metadata from a given path. Unlike `gcp-metadata` this method
 * does not parse with `json-bigint` since the keys accessed 
 * @param {string} path 
 * @returns {Promise<string>}
 */
function metadataQuery(path) {
    const baseUrl = new URL('/', 'http://metadata.google.internal');
    const options = {
        method: 'GET',
        headers: { 'Metadata-Flavor': 'Google' },
        signal: AbortSignal.timeout(1000),
    };
    return fetch(`${baseUrl}/computeMetadata/v1/${path}`, options)
        .then((res) => {
            // Validate status
            if (!(res.status >= 200 && res.status < 300)) {
                throw new Error(`Invalid response from metadata service: invalid status code: ${res.status} text: ${res.statusText}`);
            }
            // Validation from gcp-metadata
            // https://github.com/googleapis/gcp-metadata/blob/d8a868e5f487dcc3dd4bfd2d59d8c331fcf2895b/src/index.ts#L177
            const headerVal = res.headers.get('metadata-flavor');
            if (res.headers.get('metadata-flavor') !== 'Google') {
                throw new Error(`Invalid response from metadata service: incorrect 'Metadata-Flavor' header. Expected 'Google', got ${headerVal || 'no header'}`);
            }
            return res.text();
        });
}

module.exports = {
    gcpDetector
};
