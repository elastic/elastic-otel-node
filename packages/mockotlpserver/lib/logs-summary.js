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
const {style} = require('./styling');

class LogsSummaryPrinter extends Printer {
    /**
     * LogRecords vs Events
     * OTel *events* use the logs OTLP requests as a transport. They are
     * compatible, but somewhat different in structure:
     * - there is always a name, the `event.name` attribute
     * - no `severityText` for events, but yes to `severityNumber`
     * See https://opentelemetry.io/docs/specs/otel/logs/event-api/#eventlogger
     *
     * Note that AFAIK it is totally fine for an emitted *log record* to have
     * a `event.name` attribute. That might cause confusion in tools that
     * know about and expect the body to follow a schema in that case, though.
     */
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
                    let sev = `SEV-${rec.severityNumber}`;
                    if (rec.severityText) {
                        sev = `${rec.severityText}/${sev}`;
                    }
                    const hasAttrs = !!rec.attributes;
                    const isEvent = hasAttrs && rec.attributes['event.name'];
                    let lead = `[${time}] ${sev} (${meta}):`;
                    let bodyInLead = false;
                    if (isEvent) {
                        lead += ` ${style('event', 'bold')} "${style(
                            rec.attributes['event.name'],
                            'magenta'
                        )}"`;
                    } else if (
                        typeof rec.body === 'string' &&
                        rec.body.indexOf('\n') === -1
                    ) {
                        lead += ' ' + style(rec.body, 'cyan');
                        bodyInLead = true;
                    }
                    rendering.push(lead);

                    // Body, if not already included.
                    if (bodyInLead) {
                        // pass
                    } else if (typeof rec.body === 'string') {
                        rendering.push(
                            style(
                                '    ' + rec.body.split(/\n/).join('\n    '),
                                'cyan'
                            )
                        );
                    } else {
                        rendering.push(
                            '    ' +
                                util
                                    .inspect(rec.body, {
                                        depth: 10,
                                        colors: true,
                                        compact: false,
                                    })
                                    .split(/\n/)
                                    .join('\n    ')
                        );
                    }

                    // Attributes.
                    if (hasAttrs && !bodyInLead) {
                        rendering.push('    --');
                    }
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
