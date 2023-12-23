const dashdash = require('dashdash');

const luggite = require('./luggite');
const {startHttp} = require('./http');
const {startGrpc} = require('./grpc');
const {startUi} = require('./ui');
const {JSONPrinter, InspectPrinter} = require('./printers');
const {TraceWaterfallPrinter} = require('./waterfall');

const log = luggite.createLogger({name: 'mockotlpserver'});

// Default hostname to 'localhost', because that is what `DEFAULT_COLLECTOR_URL`
// uses in the OTel core exporter packages. Note that 'localhost' can by IPv6
// '::1' or IPv4 '127.0.0.1', which can potentially cause confusion.
const DEFAULT_HOSTNAME = 'localhost';
const DEFAULT_HTTP_PORT = 4318;
const DEFAULT_GRPC_PORT = 4317;
const DEFAULT_UI_PORT = 8080;

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

function main() {
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

    // Start a server which accepts incoming OTLP/HTTP calls and publishes
    // received request data to the `otlp.*` diagnostic channels.
    // Handles `OTEL_EXPORTER_OTLP_PROTOCOL=http/proto` and
    // `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`.
    startHttp({
        log,
        hostname: DEFAULT_HOSTNAME,
        port: DEFAULT_HTTP_PORT,
    });

    // Start a server which accepts incoming OTLP/gRPC calls and publishes
    // received request data to the `otlp.*` diagnostic channels.
    // Handles `OTEL_EXPORTER_OTLP_PROTOCOL=grpc`.
    // NOTE: to debug read this: https://github.com/grpc/grpc-node/blob/master/TROUBLESHOOTING.md
    startGrpc({
        log,
        hostname: DEFAULT_HOSTNAME,
        port: DEFAULT_GRPC_PORT,
    });

    startUi({
        log,
        hostname: DEFAULT_HOSTNAME,
        port: DEFAULT_UI_PORT,
    });

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
