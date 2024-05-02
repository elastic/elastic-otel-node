/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
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

/**
 * This printer converts to a possible JSON representation of each service
 * request and saves it to a file. **Warning**: Converting OTLP service requests to JSON is fraught.
 */
class FilePrinter extends Printer {
    constructor(log, indent, signals = ['trace'], dbDir = path.resolve(__dirname, '../db')) {
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

        // Group als spans from the same trace into an ndjson file
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

module.exports = {
    Printer,
    JSONPrinter,
    InspectPrinter,
    FilePrinter,
};
