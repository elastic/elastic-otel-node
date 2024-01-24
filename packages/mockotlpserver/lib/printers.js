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
const {jsonStringifyMetrics, jsonStringifyTrace} = require('./normalize');

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
    constructor(log) {
        super(log);
        /** @private */
        this._inspectOpts = {
            depth: 13, // Need 13 to get full metrics data structure.
            breakLength: process.stdout.columns || 120,
        };
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
 * This printer converts to a possible JSON representation of each service
 * request. **Warning**: Converting OTLP service requests to JSON is fraught.
 */
class JSONPrinter extends Printer {
    constructor(log, indent) {
        super(log);
        this._indent = indent || 0;
    }
    printTrace(trace) {
        const str = jsonStringifyTrace(trace, {
            indent: this._indent,
            normAttributes: true,
        });
        console.log(str);
    }
    printMetrics(metrics) {
        const str = jsonStringifyMetrics(metrics, {
            indent: this._indent,
            normAttributes: true,
        });
        console.log(str);
    }
    printLogs(logs) {
        // TODO: cope with similar conversion issues as for trace above
        console.log(JSON.stringify(logs, null, this._indent));
    }
}

module.exports = {
    Printer,
    JSONPrinter,
    InspectPrinter,
};
