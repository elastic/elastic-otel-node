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

const globals = require('globals');
const eslintJs = require('@eslint/js');
const prettierConfig = require('eslint-config-prettier');
const licenseHeaderPlugin = require('eslint-plugin-license-header');
const nPlugin = require('eslint-plugin-n');
const promisePlugin = require('eslint-plugin-promise');
const importPlugin = require('eslint-plugin-import');
const prettierPlugin = require('eslint-plugin-prettier');

module.exports = [
    {
        // This block should *only* have the "ignores" property.
        // https://eslint.org/docs/latest/use/configure/configuration-files#globally-ignoring-files-with-ignores
        ignores: [
            '*.example.js', // a pattern for uncommited local dev files to avoid linting
            '*.example.mjs', // a pattern for uncommited local dev files to avoid linting
            '/.nyc_output',
            'node_modules',
            'tmp',
            '*.min.js',
            'lib/luggite.js',
            'ui/**', // TODO: some files in here make eslint stall
        ],
    },
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
            parserOptions: {
                ecmaFeatures: {},
            },
        },
        plugins: {
            'license-header': licenseHeaderPlugin,
            n: nPlugin,
            promise: promisePlugin,
            import: importPlugin,
            prettier: prettierPlugin,
        },
        rules: {
            ...eslintJs.configs.recommended.rules,
            ...prettierConfig.rules,
            'prettier/prettier': ['error'],
            'license-header/header': ['error', './scripts/license-header.js'],

            // Restoring some config from standardjs that we want to maintain at least
            // for now -- to assist with transition to prettier.
            'no-unused-vars': [
                // See taav for possible better 'no-unused-vars' rule.
                'error',
                {
                    args: 'none',
                    caughtErrors: 'none',
                    ignoreRestSiblings: true,
                    vars: 'all',
                },
            ],
            'no-empty': [
                'error',
                {
                    allowEmptyCatch: true,
                },
            ],
            'no-constant-condition': [
                'error',
                {
                    checkLoops: false,
                },
            ],
            'n/handle-callback-err': ['error', '^(err|error)$'],
            'n/no-callback-literal': ['error'],
            'n/no-deprecated-api': ['error'],
            'n/no-exports-assign': ['error'],
            'n/no-new-require': ['error'],
            'n/no-path-concat': ['error'],
            'n/process-exit-as-throw': ['error'],
            'promise/param-names': ['error'],
            // Undo this config from eslint:recommended for now (standardjs didn't have it.)
            'require-yield': ['off'],
            'import/export': 'error',
            'import/first': 'error',
            'import/no-absolute-path': [
                'error',
                {esmodule: true, commonjs: true, amd: false},
            ],
            'import/no-duplicates': 'error',
            'import/no-named-default': 'error',
            'import/no-webpack-loader-syntax': 'error',
            // Some defaults have changed in v9
            'dot-notation': ['error'],
            'new-cap': ['error', {capIsNew: false}],
            'no-eval': ['error', {allowIndirect: true}],
            'no-new': ['error'],
            yoda: ['error'],
            'valid-typeof': ['error'],
        },
    },
];
