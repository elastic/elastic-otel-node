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
