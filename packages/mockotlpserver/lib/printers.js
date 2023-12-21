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
    constructor(log) {
        this._log = log;
    }
    subscribe() {
        /** @type {any} */
        const inst = this;
        if (typeof inst.printTrace === 'function') {
            // TODO: do this for the other print*().
            diagchSub(CH_OTLP_V1_TRACE, (...args) => {
                try {
                    inst.printTrace(...args);
                } catch (err) {
                    console.error('TODO <className>.printTrace threw: %s', err);
                }
            });
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
    constructor(log) {
        super(log);
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

module.exports = {
    Printer,
    InspectPrinter,
};
