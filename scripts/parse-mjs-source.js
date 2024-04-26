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

const acorn = require('acorn-node');
const walk = require('acorn-node/walk');

function find(source, opts) {
    const ast = acorn.parse(source, {
        // to parse ESM
        sourceType: 'module',
        // top level await
        allowAwaitOutsideFunction: true,
    });

    const modules = [];

    // TODO: walk the AST and return the list of modues in
    // `strings` property
    walk.recursive(ast, null, {
        // import { a, b, c } from 'module';
        ImportDeclaration(node) {
            modules.push(node.source.value);
        },
        // export { a, b, c } from 'module';
        ExportNamedDeclaration(node) {
            modules.push(node.source.value);
        },
        // const x = await import('module');
        ExpressionStatement(node) {
            if (
                node.expression.type === 'AwaitExpression' &&
                node.expression.argument.type === 'CallExpression' &&
                node.expression.argument.callee.type === 'Import'
            ) {
                modules.push(node.expression.argument.arguments[0].value);
            }
        },
    });

    // Cleanup `node:` prefix for built-in modules
    return modules.map((m) => m.replace(/^node:/, ''));
}

module.exports = function (src, opts) {
    return find(src, opts);
};
