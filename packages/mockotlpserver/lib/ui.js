const fs = require('fs');
const path = require('path');

const httpServer = require('http-server');

const {Printer} = require('./printers');

// helper functions

/**
 * @typedef {Object} SpanTree
 * @property {import('./types').Span} span
 * @property {import('./types').Span[]} children
 */

/**
 * @typedef {Object} TraceTree
 * @property {string} id
 * @property {SpanTree[]} children
 */

class UiPrinter extends Printer {
    constructor(log) {
        super(log);
        this._dbDir = path.resolve(__dirname, '../db');
    }

    /**
     * Prints into files the spns belonging to a trace
     * @param {import('./types').ExportTraceServiceRequest} traceReq
     */
    printTrace(traceReq) {
        /** @type {Map<string, import('./types').Span[]>} */
        const tracesMap = new Map();

        // Group all spans by trace
        traceReq.resourceSpans.forEach((resSpan) => {
            resSpan.scopeSpans.forEach((scopeSpan) => {
                scopeSpan.spans.forEach((span) => {
                    const traceId = span.traceId.toString('hex');
                    let traceSpans = tracesMap.get(traceId);

                    if (!traceSpans) {
                        traceSpans = [];
                        tracesMap.set(traceId, traceSpans);
                    }
                    traceSpans.push(span);
                });
            });
        });

        // Write into a file
        // TODO: manage lifetime of old trace ndjson files.
        for (const [traceId, traceSpans] of tracesMap.entries()) {
            const filePath = path.join(this._dbDir, `trace-${traceId}.ndjson`);
            const stream = fs.createWriteStream(filePath, {
                flags: 'a',
                encoding: 'utf-8',
            });

            for (const span of traceSpans) {
                stream.write(JSON.stringify(span) + '\n');
            }
            stream.close();
        }
    }
}

/**
 *
 * @param {Object} opts
 * @param {import('./luggite').LoggerInstance} opts.log
 * @param {string} opts.hostname
 * @param {number} opts.port
 */
function startUi(opts) {
    const {log, hostname, port} = opts;
    const server = httpServer.createServer({
        root: path.join(__dirname, '/../ui'),
    });

    server.listen(port, hostname, function () {
        const endpoint = `http://${hostname}:${port}`;
        log.info(`UI listening at ${endpoint}`);
    });

    // Use specific printer for UI
    const printer = new UiPrinter(log);
    printer.subscribe();
}

module.exports = {
    startUi,
};
