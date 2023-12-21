const fs = require('fs');
const path = require('path');

/**
 * Various "Printers" the subscribe to `otlp.*` diagnostic channels and print
 * the results in various formats.
 *
 * Usage:
 *      const printer = new InspectPrinter();
 *      printer.subscribe();
 */

const {
    diagchSub,
    CH_OTLP_V1_LOGS,
    CH_OTLP_V1_METRICS,
    CH_OTLP_V1_TRACE,
} = require('./diagch');

// TODO: typewise it would be nice to have a type that forces printers
// to have at least one of the functions
// We can consider do composition instead of inheritance
// const Printer = {
//     subscribe () { ... }
// }
// const InspectPrinter = { ... }

// function getPrinterInstance (specificPrinter) {
//     return Object.assign({}, Printer, specificPrinter);
// }

// // usage
// const inspectPrinter = getPrinterInstance(InspectPrinter);
// inspectPrinter.subscribe();

/** Abstract printer class */
class Printer {
    subscribe() {
        /** @type {any} */
        const inst = this;
        if (typeof inst.printTrace === 'function') {
            diagchSub(CH_OTLP_V1_TRACE, inst.printTrace.bind(this));
        }
        if (typeof inst.printMetrics === 'function') {
            diagchSub(CH_OTLP_V1_METRICS, inst.printMetrics.bind(this));
        }
        if (typeof inst.printLogs === 'function') {
            diagchSub(CH_OTLP_V1_LOGS, inst.printTrace.bind(this));
        }
    }
}

/**
 * Specific printer for inspect format
 * @extends {Printer}
 */
class InspectPrinter extends Printer {
    constructor() {
        super();
        /** @private */
        this._inspectOpts = {depth: 9, breakLength: process.stdout.columns};
    }
    printTrace(trace) {
        console.dir(trace, this._inspectOpts);
    }
    printMetrics(metrics) {
        console.dir(metrics, this._inspectOpts);
    }
    printLogs(logs) {
        console.dir(logs, this._inspectOpts);
    }
}

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
                    const traceId = span.traceId.toString();
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
        const tracesPath = path.join('__dirname', '/../ui/traces');
        for (const [traceId, traceSpans] of tracesMap.entries()) {
            const filePath = path.join(tracesPath, `${traceId}.ndjson`);
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

module.exports = {
    InspectPrinter,
    UiPrinter,
};
