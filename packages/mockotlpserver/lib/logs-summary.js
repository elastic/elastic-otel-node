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
 * A "Printer" of logs data that attempts a reasonable short summary.
 */

const util = require('util');

const {hrTimeToTimeStamp, millisToHrTime} = require('@opentelemetry/core');

const {Printer} = require('./printers');
const {normalizeLogs} = require('./normalize');

// This color-related block from Bunyan, with permission. ;)
// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
// Suggested colors (some are unreadable in common cases):
// - Good: cyan, yellow (limited use), bold, green, magenta, red
// - Bad: blue (not visible on cmd.exe), grey (same color as background on
//   Solarized Dark theme from <https://github.com/altercation/solarized>, see
//   issue #160)
var colors = {
    bold: [1, 22],
    italic: [3, 23],
    underline: [4, 24],
    inverse: [7, 27],
    white: [37, 39],
    grey: [90, 39],
    black: [30, 39],
    blue: [34, 39],
    cyan: [36, 39],
    green: [32, 39],
    magenta: [35, 39],
    red: [31, 39],
    yellow: [33, 39],
};
function stylizeWithColor(str, color) {
    if (!str) return '';
    var codes = colors[color];
    if (codes) {
        return '\x1b[' + codes[0] + 'm' + str + '\x1b[' + codes[1] + 'm';
    } else {
        return str;
    }
}

class LogsSummaryPrinter extends Printer {
    printLogs(rawLogs) {
        const logs = normalizeLogs(rawLogs);

        const rendering = [];
        let numRecs = 0;
        for (let resourceLogs of logs.resourceLogs) {
            let resource = resourceLogs.resource;
            for (let scopeLogs of resourceLogs.scopeLogs || []) {
                for (let rec of scopeLogs.logRecords) {
                    numRecs += 1;
                    const time = hrTimeToTimeStamp(
                        millisToHrTime(Number(BigInt(rec.timeUnixNano)) / 1e6)
                    );
                    const meta = [
                        resource.attributes['service.name'],
                        'traceId' in rec
                            ? `traceId=${rec.traceId.slice(0, 6)}`
                            : null,
                        'spanId' in rec
                            ? `spanId=${rec.spanId.slice(0, 6)}`
                            : null,
                    ]
                        .filter((elem) => elem)
                        .join(', ');
                    // TODO: Could add colouring of the severity value based on severityNumber ranges.
                    rendering.push(
                        `[${time}] ${rec.severityText}/${
                            rec.severityNumber
                        } (${meta}): ${stylizeWithColor(rec.body, 'cyan')}`
                    );
                    if (
                        rec.attributes &&
                        Object.keys(rec.attributes).length > 0
                    ) {
                        let attrSummary = util
                            .inspect(rec.attributes, {
                                depth: 10,
                                colors: true,
                                compact: false,
                            })
                            .split(/\n/)
                            .slice(1, -1)
                            .join('\n  ');
                        rendering.push('  ' + attrSummary);
                    }
                }
            }
        }

        rendering.unshift(`------ logs (${numRecs} records) ------`);

        // Hack delay in printing so that this "summary" printer output
        // appears after "inspect" or "json" printer output for other signals
        // flushed at about the same time.
        setTimeout(() => {
            console.log(rendering.join('\n'));
        }, 10);
    }
}

module.exports = {
    LogsSummaryPrinter,
};
