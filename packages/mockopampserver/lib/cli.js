#!/usr/bin/env node

/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * mockopampserver CLI. Try `mockopampserver --htlp`.
 */

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
        default: 'info',
    },
    {
        names: ['hostname'],
        type: 'string',
        help: `The hostname on which servers should listen, by default this is "${DEFAULT_HOSTNAME}".`,
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

    const opampServer = new MockOpAMPServer({
        log,
        hostname: opts.hostname || DEFAULT_HOSTNAME,
    });
    await opampServer.start();

    log.trace({cliOpts: opts}, 'started');
}

main();
