/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
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
