/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-graphql.js
//
const otel = require('@opentelemetry/api');
const graphql = require('graphql');

async function main() {
    const {schema, source} = setup();
    const result = await graphql.graphql({schema, source});
    console.dir(result, {depth: 9});
}

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-parent-span', async (span) => {
    await main();
    span.end();
});

// helper functions
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
                    id: {type: graphql.GraphQLInt},
                },
                resolve(obj, args, context) {
                    return Promise.resolve({id: args.id, desc: 'todo desc'});
                },
            },
        },
    });
    const schema = new graphql.GraphQLSchema({query});
    const source = `
        query {
            todo (id: 0) {
                desc
            }
        }
    `;
    return {schema, source};
}
