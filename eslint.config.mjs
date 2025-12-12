/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import js from '@eslint/js';
import globals from 'globals';
import {defineConfig} from 'eslint/config';
import promisePlugin from 'eslint-plugin-promise';
import nodePlugin from 'eslint-plugin-n';
import importPlugin from 'eslint-plugin-import';
import yalhPlugin from 'eslint-plugin-yet-another-license-header';

const licenseHeader = `
/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
`;

export default defineConfig([
    {
        ignores: [
            '**/*.example.js',
            '**/*.example.mjs',
            '**/.nyc_output/**',
            '**/node_modules/**',
            '**/tmp/**',
            '**/build/**',
            '**/*.min.js',
            '**/lib/luggite.js',
            '**/lib/generated/**',
            'packages/opentelemetry-node/test/fixtures/a-ts-proj/index.js',
        ],
    },

    {
        files: ['**/*.js'],
        languageOptions: {sourceType: 'commonjs'},
    },

    {
        files: ['**/*.{js,mjs,cjs}'],
        plugins: {
            js,
            promise: promisePlugin,
            n: nodePlugin,
            import: importPlugin,
            'yet-another-license-header': yalhPlugin,
        },
        extends: ['js/recommended'],
        languageOptions: {
            globals: globals.node,
        },
        rules: {
            // TODO(trentm): See taav for possible better 'no-unused-vars' rule using '_' prefix. FWIW, ojc only warns.
            'no-unused-vars': [
                'error',
                {
                    args: 'none',
                    caughtErrors: 'none',
                    ignoreRestSiblings: true,
                    vars: 'all',
                },
            ],

            // https://github.com/eslint-community/eslint-plugin-promise#usage
            // TODO: there are more rules to consider, also 'recommended'
            'promise/param-names': 'error',

            // https://github.com/eslint-community/eslint-plugin-n#-rules
            // TODO: there are more rules to consider, also 'recommended'
            'n/handle-callback-err': ['error', '^(err|error)$'],
            'n/no-callback-literal': ['error'],
            'n/no-deprecated-api': ['error'],
            'n/no-exports-assign': ['error'],
            'n/no-new-require': ['error'],
            'n/no-path-concat': ['error'],
            'n/process-exit-as-throw': ['error'],

            // https://github.com/import-js/eslint-plugin-import#rules
            // TODO: there are more rules to consider, also 'recommended'
            'import/export': 'error',
            'import/first': 'error',
            'import/no-absolute-path': [
                'error',
                {
                    esmodule: true,
                    commonjs: true,
                    amd: false,
                },
            ],
            'import/no-duplicates': 'error',
            'import/no-named-default': 'error',
            'import/no-webpack-loader-syntax': 'error',

            // https://github.com/trentm/eslint-plugin-yet-another-license-header#usage
            'yet-another-license-header/header': [
                'error',
                {
                    header: licenseHeader,
                },
            ],
        },
    },

    // Try to ensure we don't have errant `console.*` usage in EDOT Node.js.
    {
        files: ['packages/opentelemetry-node/lib/**/*.{js,mjs,cjs}'],
        rules: {
            'no-console': 'warn',
        },
    },
]);
