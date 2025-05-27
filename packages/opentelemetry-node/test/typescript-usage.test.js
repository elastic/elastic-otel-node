/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Test that this package can be used from TypeScript code.

const {exec} = require('child_process');
const path = require('path');

const test = require('tape');

test('typescript usage', (t) => {
    const FIXTURE_DIR = './fixtures/a-ts-proj';
    exec(
        'npm run test-all-versions',
        {cwd: path.resolve(__dirname, FIXTURE_DIR)},
        function (err, stdout, stderr) {
            t.error(
                err,
                `"npm run test-all-versions" in "${FIXTURE_DIR}" succeeded`
            );
            if (err) {
                t.comment(
                    `$ npm run test-all-versions\n-- stdout --\n${stdout}\n-- stderr --\n${stderr}\n--`
                );
            }
            t.end();
        }
    );
});
