/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @typedef {import('@opentelemetry/resources').ResourceDetector} ResourceDetector
 */

const {suppressTracing} = require('@opentelemetry/core');
const {context} = require('@opentelemetry/api');
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
const jsonBigint = require('json-bigint');

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
                    projectId: metadataQuery('project/project-id'),
                    instanceId: metadataQuery('instance/id').then((id) =>
                        id.toString()
                    ),
                    zoneId: metadataQuery('instance/zone'),
                    clusterName: metadataQuery(
                        'instance/attributes/cluster-name'
                    ),
                    hostname: metadataQuery('instance/hostname'),
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
            [SEMRESATTRS_HOST_ID]: metadataPromise.then((md) => md?.instanceId),
            [SEMRESATTRS_HOST_NAME]: metadataPromise.then((md) => md?.hostname),
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
        return {attributes};
    },
};

/**
 * @returns {Promise<boolean>}
 */
function isAvailable() {
    return metadataRequest('instance')
        .then(() => true)
        .catch(() => false);
}

/**
 * Queries in gcp detector return '' if request failed
 * e.g. https://github.com/open-telemetry/opentelemetry-js-contrib/blob/d2c1be459651521c6595bd5209526890eceb2a8f/detectors/node/opentelemetry-resource-detector-gcp/src/detectors/GcpDetector.ts#L92-L96
 * @param {string} path
 * @returns {Promise<string>}
 */
function metadataQuery(path) {
    return metadataRequest(path).catch(() => '');
}

/**
 * Returns the metadata from a given path. Unlike `gcp-metadata` this method
 * does not parse with `json-bigint` since the keys accessed
 * @param {string} path
 * @returns {Promise<string>}
 */
function metadataRequest(path) {
    const baseUrl = 'http://metadata.google.internal:80';
    const options = {
        method: 'GET',
        headers: {'Metadata-Flavor': 'Google'},
        signal: AbortSignal.timeout(1000),
    };
    return fetch(`${baseUrl}/computeMetadata/v1/${path}`, options)
        .then((res) => {
            // Validate status
            if (!(res.status >= 200 && res.status < 300)) {
                throw new Error(
                    `Invalid response from metadata service: invalid status code: ${res.status} text: ${res.statusText}`
                );
            }
            // Validation from gcp-metadata
            // https://github.com/googleapis/gcp-metadata/blob/d8a868e5f487dcc3dd4bfd2d59d8c331fcf2895b/src/index.ts#L177
            const headerVal = res.headers.get('metadata-flavor');
            if (res.headers.get('Metadata-Flavor') !== 'Google') {
                throw new Error(
                    `Invalid response from metadata service: incorrect 'Metadata-Flavor' header. Expected 'Google', got ${
                        headerVal || 'no header'
                    }`
                );
            }
            return res.text();
        })
        .then((txt) => {
            // ref: https://github.com/googleapis/gcp-metadata/blob/d8a868e5f487dcc3dd4bfd2d59d8c331fcf2895b/src/index.ts#L184
            try {
                return jsonBigint.parse(txt);
            } catch {
                // nothing
            }
            return txt;
        });
}

module.exports = {
    gcpDetector,
};
