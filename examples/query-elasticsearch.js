/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An example of tracing the Elasticsearch JS client.
 *
 * 1. First, start a local Elasticsearch instance to query.
 *    (This script adds data to a `sample_data` index.)
 *
 *          docker run -d --name elasticsearch -p 9200:9200 \
 *              -e "discovery.type=single-node" \
 *              -e "xpack.security.enabled=false" --rm elasticsearch:9.3.1
 *
 *    Wait for Elasticsearch to startup and respond successfully to:
 *
 *          curl -i localhost:9200/
 *
 * 2. Run this script with EDOT Node.js:
 *
 *          node --import @elastic/opentelemetry-node query-elasticsearch.js
 *
 *    You should see a few traces: for `bulk`, `esql.async_query`, and `search`.
 *
 * 3. Clean up the Elasticsearch instance when done:
 *
 *          docker kill elasticsearch
 */

const {Client} = require('@elastic/elasticsearch');

async function main() {
    const client = new Client({node: 'http://localhost:9200'});

    await client.bulk({
        operations: [
            {index: {_index: 'sample_data'}},
            {
                '@timestamp': '2023-10-23T13:33:34.937Z',
                client_ip: '172.21.0.5',
                message: 'Disconnected',
                event_duration: 1232382,
            },
            {index: {_index: 'sample_data'}},
            {
                '@timestamp': '2023-10-23T13:51:54.732Z',
                client_ip: '172.21.3.15',
                message: 'Connection error',
                event_duration: 725448,
            },
            {index: {_index: 'sample_data'}},
            {
                '@timestamp': '2023-10-23T13:52:55.015Z',
                client_ip: '172.21.3.15',
                message: 'Connection error',
                event_duration: 8268153,
            },
        ],
    });

    let res = await client.esql.asyncQuery({
        query: 'FROM sample_data | LIMIT 2',
    });
    console.log('ES|QL:', res);

    res = await client.search({
        index: 'sample_data',
        query: {match: {message: 'error'}},
    });
    console.log('search', res);
}

main();
