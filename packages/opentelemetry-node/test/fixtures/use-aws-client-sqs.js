/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-aws-client-sqs.js

// This script can also be used for manual testing of APM instrumentation of SQS
// against a real SQS account. This can be useful because tests are done against
// a local HTTP server that *simulates* SQS with imperfect fidelity.
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
//    node use-aws-client-sqs.js

const {SQSClient, ListQueuesCommand} = require('@aws-sdk/client-sqs');

async function main() {
    const region = process.env.TEST_REGION || 'us-east-2';
    const endpoint = process.env.TEST_ENDPOINT || null;
    const sqsClient = new SQSClient({
        region,
        endpoint,
    });

    const command = new ListQueuesCommand({});
    const data = await sqsClient.send(command);
    console.log({data}, 'listQueues');
}

main();
