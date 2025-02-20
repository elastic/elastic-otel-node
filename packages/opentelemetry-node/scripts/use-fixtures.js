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

const dotenv = require('dotenv');
// const semver = require('semver');
const { MockOtlpServer } = require('@elastic/mockotlpserver');

const edotPath = path.join(__dirname, '..');
const testEnvPath = path.join(edotPath, 'test', 'test-services.env');
const fixturesPath = path.join(edotPath, 'test', 'fixtures');
const edotVersion = require(path.join(edotPath, 'package.json')).version;

/**
 * @param {string} name
 * @returns {boolean}
 */
function validFixture(name) {
    const exclude = ['-aws-', '-fs', '-fastify', 'host-metrics', 'elastic-openai'];
    return name.endsWith('.js') && !exclude.some((e) => name.includes(e));
}

async function main() {
    // TODO: more validations?
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

    console.log('starting services');
    execSync('docker compose -f ./test/docker-compose.yaml up -d --wait', {cwd: edotPath});
    console.log('services started');

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

    const servicesEnv = dotenv.parse(Buffer.from(fs.readFileSync(testEnvPath)))

    const fixtures = fs.readdirSync(fixturesPath).filter(validFixture);
    for (const fixture of fixtures) {
        const serviceName = fixture.replace('.js', '-service');
        const fixtFile = path.join(fixturesPath, fixture);
        const attribs = [
            `service.name=${serviceName}`,
            `service.version=${edotVersion}`,
            'deployment.environment=test',
        ];

        console.log(`running fixture ${fixture}`);
        await new Promise((resolve, reject) => {
            execFile(
                process.execPath,
                [fixtFile],
                {
                    killSignal: 'SIGINT',
                    env: Object.assign(
                        {},
                        process.env,
                        servicesEnv,
                        {
                            OTEL_EXPORTER_OTLP_ENDPOINT:
                                otlpServer.httpUrl.href, // trick EDOT to send to mocotlpserver
                            OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf', // JSON not accepted by APM server
                            OTEL_RESOURCE_ATTRIBUTES: attribs.join(','),
                            NODE_OPTIONS: '--require=@elastic/opentelemetry-node',
                        },
                    ),
                },
                async function done(err, stdout, stderr) {
                    if (err) {
                        console.log(`fixture ${fixture} errored`);
                        console.log(`stdout: ${stdout}`);
                        console.log(`stderr: ${stderr}`);
                        return reject(err);
                    }
                    console.log(`fixture ${fixture} okay`);
                    // console.log(`stdout: ${stdout}`);
                    resolve();
                }
            )
        });
    }

    console.log('ran all text fixtures');
    await otlpServer.close();

    console.log('stopping services')
    execSync('docker compose -f ./test/docker-compose.yaml down', {cwd: edotPath});
    console.log('services stopped')
}

main();
