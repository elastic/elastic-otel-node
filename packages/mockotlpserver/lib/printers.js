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

class Printer {
    subscribe() {
        if (typeof this.printTrace === 'function') {
            diagchSub(CH_OTLP_V1_TRACE, this.printTrace.bind(this));
        }
        if (typeof this.printMetrics === 'function') {
            diagchSub(CH_OTLP_V1_METRICS, this.printMetrics.bind(this));
        }
        if (typeof this.printLogs === 'function') {
            diagchSub(CH_OTLP_V1_LOGS, this.printTrace.bind(this));
        }
    }
}

class InspectPrinter extends Printer {
    constructor() {
        super();
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
    InspectPrinter,
};
