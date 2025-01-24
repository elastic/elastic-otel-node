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

// Usage: node -r @elastic/opentelemetry-node use-graphql.js
//
const otel = require('@opentelemetry/api');
const graphql = require('graphql');


async function main() {
    const { schema, source } = setup();
    const result = await graphql.graphql({ schema, source })
    console.dir(result, {depth:9});
}

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-parent-span', async (span) => {
    await main();
    span.end();
});


// hrlper functions
function setup() {
    const Todo = new graphql.GraphQLObjectType({
        name: 'Todo',
        fields: {
            id: {
                type: graphql.GraphQLString,
                resolve(obj, args) {
                    return obj.id;
                },
            },
            desc: {
                type: graphql.GraphQLString,
                resolve(obj, args) {
                    return obj.desc;
                },
            },
        },
    });
    const query = new graphql.GraphQLObjectType({
        name: 'Query',
        fields: {
            todo: {
                type: Todo,
                args: {
                    id: { type: graphql.GraphQLInt },
                },
                resolve(obj, args, context) {
                    return Promise.resolve({ id: args.id, desc: 'todo desc' });
                },
            },
        },
    });
    const schema = new graphql.GraphQLSchema({ query });
    const source = `
        query {
            todo (id: 0) {
                desc
            }
        }
    `;
    return { schema, source };
}
