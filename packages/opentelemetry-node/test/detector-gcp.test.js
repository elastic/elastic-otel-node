/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that GCP detector queries the metadata correctly

const {test} = require('tape');
const nock = require('nock');
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

const {gcpDetector} = require('../lib/detector-gcp');

const HOST_ADDRESS = 'http://metadata.google.internal';
const HEADERS = {
    'Metadata-Flavor': 'Google',
};
const BASE_PATH = '/computeMetadata/v1';
const INSTANCE_PATH = BASE_PATH + '/instance';
const INSTANCE_ID_PATH = BASE_PATH + '/instance/id';
const PROJECT_ID_PATH = BASE_PATH + '/project/project-id';
const ZONE_PATH = BASE_PATH + '/instance/zone';
const CLUSTER_NAME_PATH = BASE_PATH + '/instance/attributes/cluster-name';
const HOSTNAME_PATH = BASE_PATH + '/instance/hostname';

const envvars = [
    'KUBERNETES_SERVICE_HOST',
    'NAMESPACE',
    'CONTAINER_NAME',
    'HOSTNAME',
];
const cleanEnv = () => envvars.forEach((k) => delete process.env[k]);

// Necessary for proper mocking
nock.disableNetConnect();

test('gcpDetector - should return resource with GCP metadata', async (t) => {
    const scope = nock(HOST_ADDRESS)
        .get(INSTANCE_PATH)
        .reply(200, {}, HEADERS)
        .get(INSTANCE_ID_PATH)
        // This number is too large to be safely represented by a JS number
        // See https://github.com/googleapis/gcp-metadata/tree/fc2f0778138b36285643b2f716c485bf9614611f#take-care-with-large-number-valued-properties
        .reply(200, () => '4520031799277581759', HEADERS)
        .get(PROJECT_ID_PATH)
        .reply(200, () => 'my-project-id', HEADERS)
        .get(ZONE_PATH)
        .reply(200, () => 'project/zone/my-zone', HEADERS)
        .get(HOSTNAME_PATH)
        .reply(200, () => 'dev.my-project.local', HEADERS);

    const {attributes} = gcpDetector.detect();
    t.equal(
        await attributes[SEMRESATTRS_CLOUD_PROVIDER],
        CLOUDPROVIDERVALUES_GCP
    );
    t.equal(await attributes[SEMRESATTRS_CLOUD_ACCOUNT_ID], 'my-project-id');
    t.equal(await attributes[SEMRESATTRS_HOST_ID], '4520031799277581759');
    t.equal(await attributes[SEMRESATTRS_HOST_NAME], 'dev.my-project.local');
    t.equal(
        await attributes[SEMRESATTRS_CLOUD_AVAILABILITY_ZONE],
        'project/zone/my-zone'
    );
    t.equal(await attributes[SEMRESATTRS_K8S_CLUSTER_NAME], undefined);
    t.equal(await attributes[SEMRESATTRS_K8S_NAMESPACE_NAME], undefined);
    t.equal(await attributes[SEMRESATTRS_K8S_POD_NAME], undefined);
    t.equal(await attributes[SEMRESATTRS_CONTAINER_NAME], undefined);

    scope.done();
});

test('gcpDetector - should populate K8s attributes when KUBERNETES_SERVICE_HOST is set', async (t) => {
    process.env.KUBERNETES_SERVICE_HOST = 'my-host';
    process.env.NAMESPACE = 'my-namespace';
    process.env.HOSTNAME = 'my-hostname';
    process.env.CONTAINER_NAME = 'my-container-name';
    const scope = nock(HOST_ADDRESS)
        .get(INSTANCE_PATH)
        .reply(200, {}, HEADERS)
        .get(INSTANCE_ID_PATH)
        .reply(200, () => '4520031799277581759', HEADERS)
        .get(CLUSTER_NAME_PATH)
        .reply(200, () => 'my-cluster', HEADERS)
        .get(PROJECT_ID_PATH)
        .reply(200, () => 'my-project-id', HEADERS)
        .get(ZONE_PATH)
        .reply(200, () => 'project/zone/my-zone', HEADERS)
        .get(HOSTNAME_PATH)
        .reply(200, () => 'dev.my-project.local', HEADERS);

    const {attributes} = gcpDetector.detect();
    t.equal(
        await attributes[SEMRESATTRS_CLOUD_PROVIDER],
        CLOUDPROVIDERVALUES_GCP
    );
    t.equal(await attributes[SEMRESATTRS_CLOUD_ACCOUNT_ID], 'my-project-id');
    t.equal(await attributes[SEMRESATTRS_HOST_ID], '4520031799277581759');
    t.equal(await attributes[SEMRESATTRS_HOST_NAME], 'dev.my-project.local');
    t.equal(
        await attributes[SEMRESATTRS_CLOUD_AVAILABILITY_ZONE],
        'project/zone/my-zone'
    );
    t.equal(await attributes[SEMRESATTRS_K8S_CLUSTER_NAME], 'my-cluster');
    t.equal(await attributes[SEMRESATTRS_K8S_NAMESPACE_NAME], 'my-namespace');
    t.equal(await attributes[SEMRESATTRS_K8S_POD_NAME], 'my-hostname');
    t.equal(await attributes[SEMRESATTRS_CONTAINER_NAME], 'my-container-name');
    scope.done();
    cleanEnv();
});

test('gcpDetector - should return resource and empty data for non-available metadata attributes', async (t) => {
    // Set KUBERNETES_SERVICE_HOST to have the implementation call
    // CLUSTER_NAME_PATH, to be able to test it handling the HTTP 413.
    process.env.KUBERNETES_SERVICE_HOST = 'my-host';
    const scope = nock(HOST_ADDRESS)
        .get(INSTANCE_PATH)
        .reply(200, {}, HEADERS)
        .get(PROJECT_ID_PATH)
        .reply(200, () => 'my-project-id', HEADERS)
        .get(ZONE_PATH)
        .reply(413)
        .get(INSTANCE_ID_PATH)
        .reply(400, undefined, HEADERS)
        .get(CLUSTER_NAME_PATH)
        .reply(413)
        .get(HOSTNAME_PATH)
        .reply(400, undefined, HEADERS);

    const {attributes} = gcpDetector.detect();
    t.equal(
        await attributes[SEMRESATTRS_CLOUD_PROVIDER],
        CLOUDPROVIDERVALUES_GCP
    );
    t.equal(await attributes[SEMRESATTRS_CLOUD_ACCOUNT_ID], 'my-project-id');
    t.equal(await attributes[SEMRESATTRS_HOST_ID], '');
    t.equal(await attributes[SEMRESATTRS_HOST_NAME], '');
    t.equal(await attributes[SEMRESATTRS_CLOUD_AVAILABILITY_ZONE], '');
    t.equal(await attributes[SEMRESATTRS_K8S_CLUSTER_NAME], '');
    t.equal(await attributes[SEMRESATTRS_K8S_NAMESPACE_NAME], undefined);
    t.equal(await attributes[SEMRESATTRS_K8S_POD_NAME], undefined);
    t.equal(await attributes[SEMRESATTRS_CONTAINER_NAME], undefined);
    scope.done();
    cleanEnv();
});

test('gcpDetector - should return empty resource if not detected', async (t) => {
    const {attributes} = gcpDetector.detect();
    t.equal(await attributes[SEMRESATTRS_CLOUD_PROVIDER], undefined);
    t.equal(await attributes[SEMRESATTRS_CLOUD_ACCOUNT_ID], undefined);
    t.equal(await attributes[SEMRESATTRS_HOST_ID], undefined);
    t.equal(await attributes[SEMRESATTRS_HOST_NAME], undefined);
    t.equal(await attributes[SEMRESATTRS_CLOUD_AVAILABILITY_ZONE], undefined);
    t.equal(await attributes[SEMRESATTRS_K8S_CLUSTER_NAME], undefined);
    t.equal(await attributes[SEMRESATTRS_K8S_NAMESPACE_NAME], undefined);
    t.equal(await attributes[SEMRESATTRS_K8S_POD_NAME], undefined);
    t.equal(await attributes[SEMRESATTRS_CONTAINER_NAME], undefined);
});

// Re-enable module
nock.enableNetConnect();
