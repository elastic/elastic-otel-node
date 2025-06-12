#!/usr/bin/env node

/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * mockopampserver CLI. Try `mockopampserver --htlp`.
 */

const fs = require('fs');

const dashdash = require('dashdash');

const {log} = require('./logging');
const {DEFAULT_HOSTNAME, MockOpAMPServer} = require('./mockopampserver');

const CMD = 'mockopampserver';
const OPTIONS = [
    {
        names: ['help', 'h'],
        type: 'bool',
        help: 'Print this help and exit.',
    },
    {
        names: ['log-level', 'l'],
        type: 'string',
        help: `Set the log level to one of "trace", "debug", "info", "warn", "error", "fatal".`,
        default: 'debug',
    },
    {
        names: ['hostname'],
        type: 'string',
        help: `The hostname on which servers should listen, by default this is "${DEFAULT_HOSTNAME}".`,
    },
    {
        names: ['F'],
        type: 'arrayOfString',
        help: 'Provide a remote config file. `-F foo=@config.json` provides a remote config with the file name "foo" and the content from "config.json". The default content-type is "application/json". Use `-F =@config.json` to use an empty string for the file name. Use `-F "foo=@config.yml;type=application/yaml" to specify a content-type. (This option syntax is modelled after curl\'s `-F`.)',
    },
    // TODO: port option?
];

async function main() {
    const parser = dashdash.createParser({options: OPTIONS});
    let opts;
    try {
        opts = parser.parse({options: OPTIONS});
    } catch (err) {
        log.error({err}, `${CMD}: command-line options error`);
        process.exit(1);
    }
    log.level(opts.log_level);
    if (opts.help) {
        var help = parser.help({includeDefault: true}).trimRight();
        console.log(
            'Usage:\n' +
                '    npx @elastic/mockopampserver [OPTIONS]\n' +
                '    mockopampserver [OPTIONS]               # if installed globally\n' +
                'Options:\n' +
                help
        );
        process.exit(0);
    }

    const serverOpts = {
        log,
        hostname: opts.hostname || DEFAULT_HOSTNAME,
    };
    if (opts.F) {
        serverOpts.agentConfigMap = {
            configMap: {
                // '': {body: buf, contentType: 'application/json'},
            },
        };
        const pat = /^([^;]*)=@([^;]+)(;type=(.*))?$/;
        for (let remoteConfigArg of opts.F) {
            const match = pat.exec(remoteConfigArg);
            if (!match) {
                throw new Error(
                    `invalid '-F' arg '${remoteConfigArg}': does not match ${pat}`
                );
            }
            const filename = match[1];
            const body = fs.readFileSync(match[2]);
            const contentType = match[4] || 'application/json';
            serverOpts.agentConfigMap.configMap[filename] = {body, contentType};
        }
    }

    const opampServer = new MockOpAMPServer(serverOpts);
    await opampServer.start();

    log.trace({cliOpts: opts}, 'started');
}

main();
