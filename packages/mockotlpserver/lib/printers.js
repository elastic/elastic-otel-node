/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Various "Printers" that subscribe to `otlp.*` diagnostic channels and print
 * the results in various formats.
 *
 * Usage:
 *      const printer = new InspectPrinter(log);
 *      printer.subscribe();
 */

const fs = require('fs');
const path = require('path');

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
            depth: 100, // Need 13 for full metrics data structure, more for some logs.
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

/**
 * This printer converts to a possible JSON representation of each service
 * request and saves it to a file. **Warning**: Converting OTLP service requests to JSON is fraught.
 */
class FilePrinter extends Printer {
    constructor(
        log,
        indent,
        signals = ['trace'],
        dbDir = path.resolve(__dirname, '../db')
    ) {
        super(log);
        this._indent = indent || 0;
        this._signals = signals;
        this._dbDir = dbDir;
    }
    printTrace(trace) {
        if (!this._signals.includes('trace')) return;
        const str = jsonStringifyTrace(trace, {
            indent: this._indent,
            normAttributes: true,
        });
        const normTrace = JSON.parse(str);
        const tracesMap = new Map();
        normTrace.resourceSpans.forEach((resSpan) => {
            resSpan.scopeSpans.forEach((scopeSpan) => {
                scopeSpan.spans.forEach((span) => {
                    let traceSpans = tracesMap.get(span.traceId);

                    if (!traceSpans) {
                        traceSpans = [];
                        tracesMap.set(span.traceId, traceSpans);
                    }
                    traceSpans.push(span);
                });
            });
        });

        // Group all spans from the same trace into an ndjson file.
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
 * If there has been a `_timeGap` since the last printable-event, then print
 * a blank line in the console output to provide some visual spacing. This
 * makes the printed output easier to reason about.
 */
class SpacerPrinter extends Printer {
    constructor(log) {
        super(log);
        this._lastPrintTime = Date.now();
        this._timeGap = 1000;
    }
    _handleGap() {
        const now = Date.now();
        if (now - this._lastPrintTime > this._timeGap) {
            console.log(); // blank line spacing between earlier group
        }
        this._lastPrintTime = now;
    }
    printTrace(_) {
        this._handleGap();
    }
    printMetrics(_) {
        this._handleGap();
    }
    printLogs(_) {
        this._handleGap();
    }
}

module.exports = {
    Printer,
    JSONPrinter,
    InspectPrinter,
    FilePrinter,
    SpacerPrinter,
};
