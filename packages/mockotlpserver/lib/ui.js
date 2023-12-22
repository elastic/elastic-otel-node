const fs = require('fs');
const path = require('path');
const http = require('http');

const Long = require('long');

const {Printer} = require('./printers');

// helper functions

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
    constructor(log) {
        super(log);
        this._dbDir = path.resolve(__dirname, '../db');
    }

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
                    const traceId = span.traceId.toString('hex');
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
        // TODO: manage lifetime of old trace ndjson files.
        for (const [traceId, traceSpans] of tracesMap.entries()) {
            const filePath = path.join(this._dbDir, `trace-${traceId}.ndjson`);
            const stream = fs.createWriteStream(filePath, {
                flags: 'a',
                encoding: 'utf-8',
            });

            for (const span of traceSpans) {
                const formatted = this._formatSpan(span);
                stream.write(
                    JSON.stringify(Object.assign({}, span, formatted)) + '\n'
                );
            }
            stream.close();
        }
    }

    /**
     * @param {import('./types').Span} span
     */
    _formatSpan(span) {
        const traceId = span.traceId.toString('hex');
        const spanId = span.spanId.toString('hex');
        const parentSpanId = span.parentSpanId?.toString('hex');
        const formatted = {traceId, spanId};

        if (parentSpanId) {
            formatted.parentSpanId = parentSpanId;
        }
        formatted.startTimeUnixNano = new Long(
            span.startTimeUnixNano.low,
            span.startTimeUnixNano.high,
            span.startTimeUnixNano.unsigned
        ).toString();
        formatted.endTimeUnixNano = new Long(
            span.endTimeUnixNano.low,
            span.endTimeUnixNano.high,
            span.endTimeUnixNano.unsigned
        ).toString();

        return formatted;
    }
}

/**
 * @param {http.ServerResponse} res
 */
function send404(res) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.write('Error 404: Resource not found.');
    res.end();
}

/**
 * @param {http.ServerResponse} res
 */
function send400(res) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.write('Error 400: Bad request.');
    res.end();
}

const mimeLookup = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.png': 'image/x-png',
};

/**
 *
 * @param {Object} opts
 * @param {import('./luggite').Logger} opts.log
 * @param {string} opts.hostname
 * @param {number} opts.port
 */
function startUi(opts) {
    const {log, hostname, port} = opts;
    const assetsPath = path.resolve(__dirname, '../ui');
    const dataPath = path.resolve(__dirname, '../db');
    const server = http.createServer((req, res) => {
        req.resume();
        req.on('end', () => {
            if (req.method === 'POST') {
                return send400(res);
            }
            // API methods
            if (req.url === '/api/traces') {
                const traceFiles = fs.readdirSync(dataPath).filter((f) => {
                    return f.startsWith('trace-');
                });

                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(traceFiles));
                return;
            } else if (req.url.startsWith('/api/traces/')) {
                const traceId = req.url.replace('/api/traces/', '');
                const tracePath = path.resolve(
                    dataPath,
                    `trace-${traceId}.ndjson`
                );

                if (!fs.existsSync(tracePath)) {
                    return send404(res);
                }

                res.writeHead(200, {'Content-Type': 'text/plain'});
                fs.createReadStream(tracePath).pipe(res);
                return;
            }

            // fallback to serve static
            // TODO: check for path traversal?
            const url = new URL(req.url, `http://${hostname}:${port}`);
            const urlPath = url.pathname;

            const fileUrl = urlPath === '/' ? '/index.html' : urlPath;
            const filePath = assetsPath + fileUrl;
            const fileExt = path.extname(filePath);
            const mimeType = mimeLookup[fileExt];

            if (mimeType && fs.existsSync(filePath)) {
                res.writeHead(200, {'Content-Type': mimeType});
                fs.createReadStream(filePath).pipe(res);
                return;
            }

            res.writeHead(200, {'Content-Type': 'text/html'});
            fs.createReadStream(`${assetsPath}/404.html`).pipe(res);
        });
    });

    server.listen(port, hostname, function () {
        /** @type {any} */
        const addr = server.address();
        const endpoint =
            addr.family === 'IPv6'
                ? `http://[${addr.address}]:${addr.port}`
                : `http://${addr.address}:${addr.port}`;
        log.info(`UI listening at ${endpoint}`);
    });

    // Use specific printer for UI
    const printer = new UiPrinter(log);
    printer.subscribe();
}

module.exports = {
    startUi,
};
