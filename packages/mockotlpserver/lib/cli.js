#!/usr/bin/env node

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

/**
 * mockotlpserver CLI. Try `mockotlpserver --htlp`.
 */

const dashdash = require('dashdash');

const luggite = require('./luggite');
const {JSONPrinter, InspectPrinter, FilePrinter} = require('./printers');
const {TraceWaterfallPrinter} = require('./waterfall');
const {MetricsSummaryPrinter} = require('./metrics-summary');
const {LogsSummaryPrinter} = require('./logs-summary');
const {DEFAULT_HOSTNAME, MockOtlpServer} = require('./mockotlpserver');

const PRINTER_NAMES = [
    'trace-inspect',
    'metrics-inspect',
    'logs-inspect',
    'inspect',

    'trace-json',
    'metrics-json',
    'logs-json',
    'json',

    'trace-json2',
    'metrics-json2',
    'logs-json2',
    'json2',

    'trace-summary', // aka waterfall
    'metrics-summary',
    'logs-summary',
    'summary',

    'trace-file', // saving into fs for UI and other processing
];

/**
 * This adds a custom cli option type to dashdash, to support `-o json,waterfall`
 * options for specifying multiple printers (aka output modes).
 *
 * @param {any} option
 * @param {string} optstr
 * @param {string} arg
 * @returns {Array<string>}
 */
function parseCommaSepPrinters(option, optstr, arg) {
    const printers = arg
        .trim()
        .split(/\s*,\s*/g)
        .filter((part) => part);
    const invalids = printers.filter((p) => !PRINTER_NAMES.includes(p));
    if (invalids.length) {
        throw new Error(
            `error in "${optstr}": unknown printers: "${invalids.join(', ')}"`
        );
    }
    return printers;
}

dashdash.addOptionType({
    name: 'arrayOfPrinters',
    takesArg: true,
    helpArg: 'STRING',
    parseArg: parseCommaSepPrinters,
    array: true,
    arrayFlatten: true,
});

const CMD = 'mockotlpserver';
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
        names: ['o'],
        type: 'arrayOfPrinters',
        help: `Output formats for printing OTLP data. Comma-separated, one or more of "${PRINTER_NAMES.join(
            '", "'
        )}". Default: "inspect,summary"`,
    },
    {
        names: ['hostname'],
        type: 'string',
        help: `The hostname on which servers should listen, by default this is "${DEFAULT_HOSTNAME}".`,
    },
    {
        names: ['ui'],
        type: 'bool',
        help: 'Start a web server to inspect traces with some charts.',
    },
];

async function main() {
    const log = luggite.createLogger({name: 'mockotlpserver'});

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
                '    npx @elastic/mockotlpserver [OPTIONS]\n' +
                '    mockotlpserver [OPTIONS]               # if installed globally\n' +
                'Options:\n' +
                help
        );
        process.exit(0);
    }
    if (!opts.o) {
        // The way dashdash `--help` output prints the default of an array is
        // misleading, so we'll apply the default here and manually document
        // the default in the "help:" string above.
        opts.o = ['inspect', 'summary'];
    }

    /** @type {Array<'http'|'grpc'|'ui'>} */
    const services = ['http', 'grpc'];
    /** @type {Array<string>} */
    const outputs = opts.o;

    if (opts.ui) {
        services.push('ui');
        outputs.push('trace-file');
    }

    const otlpServer = new MockOtlpServer({
        log,
        services,
        grpcHostname: opts.hostname || DEFAULT_HOSTNAME,
        httpHostname: opts.hostname || DEFAULT_HOSTNAME,
        uiHostname: opts.hostname || DEFAULT_HOSTNAME,
    });
    await otlpServer.start();

    // Avoid duplication of printers
    const printersSet = new Set(outputs);
    const printers = [];

    printersSet.forEach((printerName) => {
        switch (printerName) {
            case 'trace-inspect':
                printers.push(new InspectPrinter(log, ['trace']));
                break;
            case 'metrics-inspect':
                printers.push(new InspectPrinter(log, ['metrics']));
                break;
            case 'logs-inspect':
                printers.push(new InspectPrinter(log, ['logs']));
                break;
            case 'inspect':
                printers.push(new InspectPrinter(log));
                break;

            case 'trace-json':
                printers.push(new JSONPrinter(log, 0, ['trace']));
                break;
            case 'metrics-json':
                printers.push(new JSONPrinter(log, 0, ['metrics']));
                break;
            case 'logs-json':
                printers.push(new JSONPrinter(log, 0, ['logs']));
                break;
            case 'json':
                printers.push(new JSONPrinter(log, 0));
                break;

            case 'trace-json2':
                printers.push(new JSONPrinter(log, 2, ['trace']));
                break;
            case 'metrics-json2':
                printers.push(new JSONPrinter(log, 2, ['metrics']));
                break;
            case 'logs-json2':
                printers.push(new JSONPrinter(log, 2, ['logs']));
                break;
            case 'json2':
                printers.push(new JSONPrinter(log, 2));
                break;

            case 'summary':
                printers.push(new TraceWaterfallPrinter(log));
                printers.push(new MetricsSummaryPrinter(log));
                printers.push(new LogsSummaryPrinter(log));
                break;
            case 'trace-summary':
                printers.push(new TraceWaterfallPrinter(log));
                break;
            case 'metrics-summary':
                printers.push(new MetricsSummaryPrinter(log));
                break;
            case 'logs-summary':
                printers.push(new LogsSummaryPrinter(log));
                break;

            case 'trace-file':
                printers.push(new FilePrinter(log));
                break;
        }
    });
    printers.forEach((p) => p.subscribe());

    log.trace({cliOpts: opts}, 'started');
}

main();
