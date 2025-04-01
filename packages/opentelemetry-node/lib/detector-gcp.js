/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @typedef {import('@opentelemetry/resources').ResourceDetector} ResourceDetector
 */
const {URL} = require('url');

const {getStringListFromEnv, suppressTracing} = require('@opentelemetry/core');
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

const JSONBigInt = require('json-bigint');

const {log} = require('./logging');

const DEFAULT_BASE_URL = new URL('/', 'http://metadata.google.internal:80');

/**
 * Checks for metadata server then fetches data
 *
 * The getMetadataGcp function will fetch cloud metadata information
 * from Amazon's IMDSv1 endpoint and return a promise with
 * the formatted metadata or undefined.
 *
 * https://cloud.google.com/compute/docs/storing-retrieving-metadata
 */
function getMetadataGcp() {
  const url = DEFAULT_BASE_URL + 'computeMetadata/v1/?recursive=true';
  return fetch(
    url,
    {
      signal: AbortSignal.timeout(1000),
      method: 'GET',
      headers: {'Metadata-Flavor': 'Google'},
    }
  )
  .then(res => res.text())
  .then(formatMetadataStringIntoObject)
  .catch((err) => {
    log.debug({err}, 'Unable to get GCP metadata');
    return undefined;
  });
}

/**
 * Builds metadata object
 *
 * Convert a GCP Cloud Engine VM metadata response
 * (https://cloud.google.com/compute/docs/metadata/default-metadata-values)
 * to the APM intake cloud metadata object
 * (https://github.com/elastic/apm/blob/main/specs/agents/metadata.md#gcp-metadata).
 *
 * See discussion about big int values here:
 * https://github.com/googleapis/gcp-metadata#take-care-with-large-number-valued-properties
 * This implementation is using the same 'json-bigint' library as 'gcp-metadata'.
 */
function formatMetadataStringIntoObject(string) {
  const data = JSONBigInt.parse(string);

  // E.g., 'projects/513326162531/zones/us-west1-b' -> 'us-west1-b'
  const az = data.instance.zone.split('/').pop();

  const metadata = {
    provider: 'gcp',
    instance: {
      id: data.instance.id.toString(), // We expect this to be a BigInt.
      name: data.instance.name,
    },
    project: {
      id: data.project.projectId,
    },
    availability_zone: az,
    region: az.slice(0, az.lastIndexOf('-')), // 'us-west1-b' -> 'us-west1'
    machine: {
      type: data.instance.machineType.split('/').pop(),
    },
  };

  return metadata;
}

/** @type {ResourceDetector} */
const gcpDetector = {
    detect() {
        const metadataPromise = getMetadataGcp();

        // TODO: switch to `@opentelemetry/resource-detector-gcp` when the below issue is fixed
        // https://github.com/open-telemetry/opentelemetry-js-contrib/issues/2320
        const attributes = {
            [SEMRESATTRS_CLOUD_PROVIDER]: metadataPromise.then(md => md?.provider),
            [SEMRESATTRS_CLOUD_ACCOUNT_ID]: metadataPromise.then(md => md?.project?.id),
            [SEMRESATTRS_HOST_ID]: metadataPromise.then(md => md?.instance?.id),
            // [SEMRESATTRS_HOST_NAME]: metadataPromise.then(md => md?.instance?.id), MISSING
            [SEMRESATTRS_CLOUD_AVAILABILITY_ZONE]: metadataPromise.then(md => md?.availability_zone),
        };

        // Add resource attributes for K8s.
        if (process.env.KUBERNETES_SERVICE_HOST) {
          // attributes[SEMRESATTRS_K8S_CLUSTER_NAME] = this._getClusterName(isAvail); MISSING
          attributes[SEMRESATTRS_K8S_NAMESPACE_NAME] = metadataPromise.then(md => md && process.env.NAMESPACE);
          attributes[SEMRESATTRS_K8S_POD_NAME] = metadataPromise.then(md => md && process.env.HOSTNAME);
          attributes[SEMRESATTRS_CONTAINER_NAME] =  metadataPromise.then(md => md && process.env.CONTAINER_NAME);
        }
        return { attributes };
    },
}

module.exports = {
  gcpDetector
};
