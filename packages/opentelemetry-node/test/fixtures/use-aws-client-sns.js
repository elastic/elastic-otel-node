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

// Usage: node -r @elastic/opentelemetry-node use-aws-client-sns.js

// This script can also be used for manual testing of APM instrumentation of SNS
// against a real SNS account. This can be useful because tests are done against
// a local HTTP server that *simulates* SNS with imperfect fidelity.
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
//    node use-aws-client-sns.js

const {SNSClient, ListTopicsCommand} = require('@aws-sdk/client-sns');

async function main() {
    const region = process.env.TEST_REGION || 'us-east-2';
    const endpoint = process.env.TEST_ENDPOINT || null;
    const snsClient = new SNSClient({
        region,
        endpoint,
    });

    const command = new ListTopicsCommand({});
    const data = await snsClient.send(command);
    console.log({data}, 'listTopics');
}

main();