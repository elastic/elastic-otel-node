/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-aws-client-s3.js

// This script can also be used for manual testing of APM instrumentation of S3
// against a real S3 account. This can be useful because tests are done against
// a local HTTP server that *simulates* S3 with imperfect fidelity.
//
// Auth note: By default this uses the AWS profile/configuration from the
// environment. If you do not have that configured (i.e. do not have
// "~/.aws/...") files, then you can still use localstack via setting:
//    unset AWS_PROFILE
//    export AWS_ACCESS_KEY_ID=fake
//    export AWS_SECRET_ACCESS_KEY=fake
// See also: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html
//
// Usage:
//    # Run against the default configured AWS profile, listing all available buckets.
//    node use-aws-client-s3.js

const {S3Client, ListBucketsCommand} = require('@aws-sdk/client-s3');

async function main() {
    const region = process.env.TEST_REGION || 'us-east-2';
    const endpoint = process.env.TEST_ENDPOINT || null;
    const s3Client = new S3Client({
        region,
        endpoint,
    });

    const command = new ListBucketsCommand({});
    const data = await s3Client.send(command);
    console.log({data}, 'listBuckets');
}

main();
