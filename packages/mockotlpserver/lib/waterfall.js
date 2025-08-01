/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A "Printer" of trace data that prints a version of a "waterfall" diagram
 * for a trace, showing parent/child relationships.
 *
 * Notes/Limitations:
 * - A *good* waterfall for a trace would visually show the start/stop times
 *   of spans. For some (most?) use cases these relative timing are more
 *   valuable than the parent/child relationships. However, this waterfall
 *   doesn't show them.
 *
 * Dev Notes / Ideas:
 * - Could render this on a shortish delay after receiving, this would increase
 *   chance of showing a distributed trace. This delay should be configurable.
 * - That delay could also help interlacing log events that come in, if/when
 *   rendering those.
 */

const {Printer} = require('./printers');
const {jsonStringifyTrace} = require('./normalize');
const {style} = require('./styling');

/*

------ trace 38eb38 (2 spans) ------
       span b8b3d4 "GET" (16.6ms, SPAN_KIND_CLIENT, GET http://localhost:3000/ -> 200)
 +11ms `- span 33fa3a "GET" (3.6ms, SPAN_KIND_SERVER, GET http://localhost:3000/ -> 200)

TODO:
- colouring: status code, gutter for start offset
- gutter for service-name? Or use color and a legend at top?
- highlight in extras if there are any dropped things
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
- note in `-- trace ...` line if there are dropped resource attributes
- span links
- span events
- Q: any contrib instr using span events for errors?
- other interesting attributes?
- messaging, db, rpc spans
- option to highlight particular attributes?
*/

function shortId(id) {
    return id.slice(0, 6);
}

let lastRenderedSpan = null;

function renderSpan(span, prefix = '') {
    const attrs = span.attributes || {};

    // 6-char wide gutter shows start time offset from preceding span.
    let gutter;
    if (lastRenderedSpan) {
        let startOffset =
            Number(
                BigInt(span.startTimeUnixNano) -
                    BigInt(lastRenderedSpan.startTimeUnixNano)
            ) / 1e6;
        let sign = startOffset >= 0 ? '+' : '-';
        let unit = 'ms';

        // Use the absolute value to do the proper unit transform
        startOffset = Math.abs(startOffset);
        if (startOffset >= 1000) {
            startOffset /= 1000;
            unit = 's';
        }
        if (startOffset >= 1000) {
            startOffset /= 60;
            unit = 'm'; // minutes
        }
        if (startOffset >= 1000) {
            startOffset /= 60;
            unit = 'h';
        }
        if (startOffset >= 1000) {
            // Seems unlikely we'll receive a trace with *days* of offset. :)
            startOffset /= 24;
            unit = 'd';
        }
        gutter = `${sign}${Math.floor(startOffset)}`;
        gutter = `${' '.repeat(4 - gutter.length)}${gutter}${unit}${' '.repeat(
            2 - unit.length
        )}`;
    } else {
        gutter = ' '.repeat(6);
    }

    let r = `${gutter} ${prefix}${style('span', 'bold')} ${shortId(
        span.spanId
    )} "${style(span.name, 'magenta')}"`;

    const extras = [];

    // TODO: do better for longer spans, `ms` might not always be the best unit.
    const durationMs =
        Number(BigInt(span.endTimeUnixNano) - BigInt(span.startTimeUnixNano)) /
        1e6;
    extras.push(`${durationMs.toFixed(1)}ms`);

    if (span?.status?.code !== 'STATUS_CODE_UNSET') {
        extras.push(span.status.code);
    }
    extras.push(span.kind); // Perhaps skip of INTERNAL or UNSPECIFIED
    // TODO
    // if (attrs['db.system']) { }
    // if (attrs['messaging.system']) { }
    // if (attrs['rpc.system']) { }
    if ('http.request.method' in attrs || 'http.method' in attrs) {
        const statusCode =
            attrs['http.response.status_code'] || attrs['http.status_code'];
        extras.push(
            [
                attrs['http.request.method'] || attrs['http.method'],
                attrs['url.full'] || attrs['http.url'],
                statusCode ? `-> ${statusCode}` : null,
            ]
                .filter((p) => p)
                .join(' ')
        );
    }
    // GenAI-related extras
    // https://github.com/open-telemetry/semantic-conventions/blob/v1.27.0/model/registry/gen-ai.yaml
    if ('gen_ai.system' in attrs) {
        extras.push(`GenAI ${attrs['gen_ai.system']}`);
        try {
            extras.push(
                `finish_reasons=${attrs['gen_ai.response.finish_reasons'].join(
                    ','
                )}`
            );
            extras.push(
                `tokens ${attrs['gen_ai.usage.input_tokens']}in/${attrs['gen_ai.usage.output_tokens']}out`
            );
        } catch (_err) {}
    }

    // Resource and Instrumentation scope info.
    // TODO: not sure if always want this info. Useful in some cases.
    const serviceName = span.resource?.attributes?.['service.name'];
    if (serviceName) {
        extras.push(`service.name=${serviceName}`);
    }
    let scopeName = span.scope?.name;
    if (scopeName) {
        const commonInstr = /^@opentelemetry\/instrumentation-(.*)$/.exec(
            scopeName
        );
        if (commonInstr) {
            extras.push(`scope=${commonInstr[1]}`);
        } else {
            extras.push(`scope=${scopeName}`);
        }
    }

    if (extras.length) {
        r += ` (${extras.join(', ')})`;
    }

    lastRenderedSpan = span;
    prefix = prefix.length === 0 ? '`- ' : '  ' + prefix;
    span.children.forEach((c) => {
        r += '\n' + renderSpan(c, prefix);
    });
    return r;
}

function renderTrace(traceId, spans, spanFromId) {
    // Using 6 dashes because that is the width of the gutter above.
    let r = `------ trace ${shortId(traceId)} (${spans.length} span${
        spans.length === 1 ? '' : 's'
    }) ------`;
    const rootSpans = spans.filter(
        (s) => !s?.parentSpanId || !spanFromId[s?.parentSpanId]
    );
    if (rootSpans.length === 0) {
        throw new Error(
            `uh, why does this trace have no root spans? spans=${spans}`
        );
    }
    lastRenderedSpan = null; // reset for start-offset handling in renderSpan()
    rootSpans.forEach((s) => {
        r += '\n' + renderSpan(s);
    });
    return r;
}

class TraceWaterfallPrinter extends Printer {
    printTrace(rawTrace) {
        // This gets a normalized trace object. See `jsonStringifyTrace`.
        const str = jsonStringifyTrace(rawTrace, {
            indent: 2,
            normAttributes: true,
        });
        const trace = JSON.parse(str);

        // Process the trace data to prepare for rendering.
        const traceIds = new Set();
        const spans = [];
        const spanFromId = {};
        trace.resourceSpans.forEach((rs) => {
            rs.scopeSpans.forEach((ss) => {
                ss.spans.forEach((s) => {
                    traceIds.add(s.traceId);
                    s.children = [];
                    s.resource = rs.resource;
                    s.scope = ss.scope;
                    spans.push(s);
                    spanFromId[s.spanId] = s;
                });
            });
        });
        spans.forEach((s) => {
            const parent = spanFromId[s?.parentSpanId];
            if (parent) {
                parent.children.push(s);
            }
        });

        let rendering = [];
        rendering.push(
            Array.from(traceIds)
                .map((traceId) =>
                    renderTrace(
                        traceId,
                        spans.filter((s) => s.traceId === traceId),
                        spanFromId // TODO this should be just spans for this traceId, but probably fine
                    )
                )
                .join('\n')
        );

        // Hack delay in printing so that this "summary" printer output
        // appears after "inspect" or "json" printer output for other signals
        // flushed at about the same time.
        setTimeout(() => {
            console.log(rendering.join('\n'));
        }, 50);
    }
}

module.exports = {
    TraceWaterfallPrinter,
};
