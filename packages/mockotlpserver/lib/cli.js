/**
 * mockotlpserver CLI. Try `mockotlpserver --htlp`.
 */

const dashdash = require('dashdash');

const luggite = require('./luggite');
const {JSONPrinter, InspectPrinter} = require('./printers');
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
];

// This adds a custom cli option type to dashdash, to support `-o json,waterfall`
// options for specifying multiple printers (aka output modes).
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
        names: ['o'],
        type: 'arrayOfPrinters',
        help: `Formats for printing OTLP data. One or more of "${PRINTER_NAMES.join(
            '", "'
        )}".`,
        default: ['inspect', 'summary'],
    },
    {
        names: ['hostname'],
        type: 'string',
        help: `The hostname on which servers should listen, by default this is "${DEFAULT_HOSTNAME}".`,
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
    if (opts.help) {
        var help = parser.help({includeDefault: true}).trimRight();
        console.log(
            'Usage:\n' +
                '    node lib/mockotlpserver.js [OPTIONS]\n' +
                'Options:\n' +
                help
        );
        process.exit(0);
    }

    const otlpServer = new MockOtlpServer({
        log,
        services: ['http', 'grpc', 'ui'],
        grpcHostname: opts.hostname || DEFAULT_HOSTNAME,
        httpHostname: opts.hostname || DEFAULT_HOSTNAME,
        uiHostname: opts.hostname || DEFAULT_HOSTNAME,
    });
    await otlpServer.start();

    const printers = [];
    opts.o.forEach((printerName) => {
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
        }
    });
    printers.forEach((p) => p.subscribe());
}

main();
