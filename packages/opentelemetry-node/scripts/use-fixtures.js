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

const {execSync, execFile} = require('child_process');
const fs = require('fs');
const path = require('path');
const {URL} = require('url');

const dotenv = require('dotenv');
// const semver = require('semver');
const { MockOtlpServer } = require('@elastic/mockotlpserver');

const edotPath = path.join(__dirname, '..');
const envPath = path.join(edotPath, 'test', 'test-services.env');
const fixtPath = path.join(edotPath, 'test', 'fixtures');
const version = require(path.join(edotPath, 'package.json')).version;

/**
 * @param {string} name
 * @returns {boolean}
 */
function validFixture(name) {
    const exclude = ['-aws-', '-fs', '-fastify', 'host-metrics', 'elastic-openai'];
    return name.endsWith('.js') && !exclude.some((e) => name.includes(e));
}

async function main() {
    if (typeof process.env.OTEL_EXPORTER_OTLP_ENDPOINT !== 'string') {
        console.log(`"OTEL_EXPORTER_OTLP_ENDPOINT" not set. Skipping`);
        return;
    }

    // ???
    // if (semver.lt(process.version, '18.0.0')) {
    //     console.log(`Process version "${process.version}" not supported. Skipping`);
    //     return;
    // }
    Object.keys(process.env).filter((k) => k.startsWith('OTEL_')).forEach((n) => {
        console.log(`env: ${n}=${process.env[n]}`);
    })

    // Start the Mock server
    const otlpServer = new MockOtlpServer({
        logLevel: 'warn',
        services: ['http'],
        httpHostname: '127.0.0.1', // avoid default 'localhost' because possible IPv6
        httpPort: 0,
        tunnel: process.env.OTEL_EXPORTER_OTLP_ENDPOINT, // set tunnel to the real endpoint
        onTrace: console.log,
        onMetrics: () => null,
        onLogs: () => null,
    });
    await otlpServer.start();
    console.log(`MockOtlpServer listening at ${otlpServer.httpUrl.href}`)

    const testEnv = dotenv.parse(Buffer.from(fs.readFileSync(envPath)))

    const fixtures = fs.readdirSync(fixtPath).filter(validFixture);
    for (const fixt of fixtures) {
        const serviceName = fixt.replace('.js', '-service');
        const fixtFile = path.join(fixtPath, fixt);

        console.log(`running fixture ${fixt}`);
        await new Promise((resolve, reject) => {
            execFile(
                process.execPath,
                [fixtFile],
                {
                    killSignal: 'SIGINT',
                    env: Object.assign(
                        {},
                        process.env,
                        testEnv,
                        {
                            OTEL_EXPORTER_OTLP_ENDPOINT:
                                otlpServer.httpUrl.href,
                            OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
                            OTEL_RESOURCE_ATTRIBUTES:`service.name=${serviceName},service.version=${version},deployment.environment=test`,
                            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
                        },
                    ),
                },
                async function done(err, stdout, stderr) {
                    if (err) {
                        console.log(`fixture ${fixt} errored`);
                        console.log(`stdout: ${stdout}`);
                        console.log(`stderr: ${stderr}`);
                        return reject(err);
                    }
                    console.log(`fixture ${fixt} okay`);
                    // console.log(`stdout: ${stdout}`);
                    resolve();
                }
            )
        });
    }

    console.log('ran all text fixtures');
    await otlpServer.close();
}

main();
