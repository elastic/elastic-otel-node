/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// `npx eslint --print-config index.js` to print calculated config.
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true, // Defines `Promise`, etc.
  },
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  plugins: [
    '@typescript-eslint',
    'import',
    'license-header',
    'prettier',
    'promise',
    'n',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: null, // set in overrides
  },
  rules: {
    'license-header/header': ['error', '../../scripts/license-header.js'],

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
      { esmodule: true, commonjs: true, amd: false },
    ],
    'import/no-duplicates': 'error',
    'import/no-named-default': 'error',
    'import/no-webpack-loader-syntax': 'error',
  },
  ignorePatterns: [
    'build',
    'scripts/license-header.js',
    '*.example.js', // a pattern for uncommited local dev files to avoid linting
    '*.example.mjs', // a pattern for uncommited local dev files to avoid linting
    'node_modules',
    'tmp',
  ],
  overrides: [
    {
      files: ['*.ts'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
      ],
      parserOptions: {
        project: './tsconfig.json',
      },
      rules: {
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-this-alias': 'off',
        '@typescript-eslint/naming-convention': [
          'error',
          {
            selector: 'memberLike',
            modifiers: ['private', 'protected'],
            format: ['camelCase'],
            leadingUnderscore: 'require',
          },
        ],
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-inferrable-types': [
          'error',
          { ignoreProperties: true },
        ],
        '@typescript-eslint/no-empty-function': ['off'],
        '@typescript-eslint/ban-types': [
          'warn',
          {
            types: {
              Function: null,
            },
          },
        ],
        '@typescript-eslint/no-shadow': ['warn'],
        'prefer-rest-params': 'off',
      },
    },
    {
      files: ['*.mjs'],
      parserOptions: {
        sourceType: 'module',
      },
    },
  ],
};
