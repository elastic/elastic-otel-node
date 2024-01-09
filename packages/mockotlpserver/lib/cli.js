/**
 * mockotlpserver CLI. Try `mockotlpserver --htlp`.
 */

const dashdash = require('dashdash');

const luggite = require('./luggite');
const {JSONPrinter, InspectPrinter} = require('./printers');
const {TraceWaterfallPrinter} = require('./waterfall');
const {MockOtlpServer} = require('./mockotlpserver');

const PRINTER_NAMES = ['inspect', 'json', 'json2', 'waterfall'];

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
        default: ['inspect', 'waterfall'],
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
    });
    await otlpServer.start();

    const printers = [];
    opts.o.forEach((printerName) => {
        switch (printerName) {
            case 'inspect':
                printers.push(new InspectPrinter(log));
                break;
            case 'json':
                printers.push(new JSONPrinter(log, 0));
                break;
            case 'json2':
                printers.push(new JSONPrinter(log, 2));
                break;
            case 'waterfall':
                printers.push(new TraceWaterfallPrinter(log));
                break;
        }
    });
    printers.forEach((p) => p.subscribe());
}

main();
