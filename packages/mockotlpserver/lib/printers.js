/**
 * Various "Printers" that subscribe to `otlp.*` diagnostic channels and print
 * the results in various formats.
 *
 * Usage:
 *      const printer = new InspectPrinter(log);
 *      printer.subscribe();
 */

const {
    diagchSub,
    CH_OTLP_V1_LOGS,
    CH_OTLP_V1_METRICS,
    CH_OTLP_V1_TRACE,
} = require('./diagch');
const {
    jsonStringifyLogs,
    jsonStringifyMetrics,
    jsonStringifyTrace,
} = require('./normalize');

/**
 * Abstract printer class.
 *
 * `subscribe()` will subscribe any `printTrace()` et al methods to the
 * relevant `otlp.*` channel, with some error handling.
 */
class Printer {
    constructor(log) {
        this._log = log;
    }
    subscribe() {
        /** @type {any} */
        const inst = this;
        if (typeof inst.printTrace === 'function') {
            diagchSub(CH_OTLP_V1_TRACE, (...args) => {
                try {
                    inst.printTrace(...args);
                } catch (err) {
                    this._log.error(
                        {err},
                        `${inst.constructor.name}.printTrace() threw`
                    );
                }
            });
        }
        if (typeof inst.printMetrics === 'function') {
            diagchSub(CH_OTLP_V1_METRICS, (...args) => {
                try {
                    inst.printMetrics(...args);
                } catch (err) {
                    this._log.error(
                        {err},
                        `${inst.constructor.name}.printMetrics() threw`
                    );
                }
            });
        }
        if (typeof inst.printLogs === 'function') {
            diagchSub(CH_OTLP_V1_LOGS, (...args) => {
                try {
                    inst.printLogs(...args);
                } catch (err) {
                    this._log.error(
                        {err},
                        `${inst.constructor.name}.printLogs() threw`
                    );
                }
            });
        }
    }
}

/**
 * Use `console.dir` (i.e. `util.inspect`) to format OTLP data.
 */
class InspectPrinter extends Printer {
    constructor(log, signals = ['trace', 'metrics', 'logs']) {
        super(log);
        /** @private */
        this._inspectOpts = {
            depth: 13, // Need 13 to get full metrics data structure.
            breakLength: process.stdout.columns || 120,
        };
        this._signals = signals;
    }
    printTrace(trace) {
        if (!this._signals.includes('trace')) return;
        console.dir(trace, this._inspectOpts);
    }
    printMetrics(metrics) {
        if (!this._signals.includes('metrics')) return;
        console.dir(metrics, this._inspectOpts);
    }
    printLogs(logs) {
        if (!this._signals.includes('logs')) return;
        console.dir(logs, this._inspectOpts);
    }
}

/**
 * This printer converts to a possible JSON representation of each service
 * request. **Warning**: Converting OTLP service requests to JSON is fraught.
 */
class JSONPrinter extends Printer {
    constructor(log, indent, signals = ['trace', 'metrics', 'logs']) {
        super(log);
        this._indent = indent || 0;
        this._signals = signals;
    }
    printTrace(trace) {
        if (!this._signals.includes('trace')) return;
        const str = jsonStringifyTrace(trace, {
            indent: this._indent,
            normAttributes: true,
        });
        console.log(str);
    }
    printMetrics(metrics) {
        if (!this._signals.includes('metrics')) return;
        const str = jsonStringifyMetrics(metrics, {
            indent: this._indent,
            normAttributes: true,
        });
        console.log(str);
    }
    printLogs(logs) {
        if (!this._signals.includes('logs')) return;
        const str = jsonStringifyLogs(logs, {
            indent: this._indent,
            normAttributes: true,
        });
        console.log(str);
    }
}

module.exports = {
    Printer,
    JSONPrinter,
    InspectPrinter,
};
