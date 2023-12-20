const http = require('http');
const path = require('path');

const protobuf = require('protobufjs');

const parsersMap = {
    'application/json': jsonParser,
    'application/x-protobuf': protoParser,
};

// TODO: for now `proto` files are copied from
// https://github.com/open-telemetry/opentelemetry-proto
// but maybe its better to have a submodule like otel-js does
const prefix = path.resolve(__dirname, '../opentelemetry/proto/');
const paths = [
    '/common/v1/common.proto',
    '/resource/v1/resource.proto',
    '/logs/v1/logs.proto',
    '/metrics/v1/metrics.proto',
    '/trace/v1/trace.proto',
    '/collector/logs/v1/logs_service.proto',
    '/collector/metrics/v1/metrics_service.proto',
    '/collector/trace/v1/trace_service.proto',
];
let root;
for (const p of paths) {
    root = protobuf.loadSync(`${prefix}${p}`, root);
}

// helper functions
function badRequest(res) {
    res.writeHead(400);
    res.end(
        JSON.stringify({
            error: {
                code: 400,
                message: 'Invalid or no data received',
            },
        })
    );
}

/**
 *
 * @param {Buffer} buff
 * @param {http.IncomingMessage} req
 */
function jsonParser(buff, req) {
    const reqText = buff.toString('utf-8');

    // NOTE: check for bignums
    return JSON.parse(reqText);
}

/**
 *
 * @param {Buffer} buff
 * @param {http.IncomingMessage} req
 */
function protoParser(buff, req) {
    const pkgPrefix = 'opentelemetry.proto.collector';
    let decoder;
    if (req.url === '/v1/logs') {
        decoder = root.lookupType(
            `${pkgPrefix}.logs.v1.ExportLogsServiceRequest`
        );
    } else if (req.url === '/v1/metrics') {
        decoder = root.lookupType(
            `${pkgPrefix}.metrics.v1.ExportMetricsServiceRequest`
        );
    } else if (req.url === '/v1/traces') {
        decoder = root.lookupType(
            `${pkgPrefix}.trace.v1.ExportTraceServiceRequest`
        );
    }

    if (decoder) {
        return decoder.decode(buff);
    }
    console.error(`no proto decoder found for ${req.url}`);
    return {};
}

/**
 *
 * @param {Buffer} buff
 * @param {http.IncomingMessage} req
 */
function unknownParser(buff, req) {
    const contentType = req.headers['content-type'];
    console.error(`parser for ${contentType} not defined for url ${req.url}`);
}

/**
 *
 * @param {Object} opts
 * @param {import('./luggite').Logger} opts.log
 * @param {string} opts.hostname
 * @param {number} opts.port
 */
function startHttp(opts) {
    const {log, hostname, port} = opts;
    const server = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            // TODO: send back the proper error
            if (chunks.length === 0) {
                return badRequest(res);
            }

            const contentType = req.headers['content-type'];
            const parseData = parsersMap[contentType] || unknownParser;
            const reqBuffer = Buffer.concat(chunks);
            const data = parseData(reqBuffer, req);

            // TODO: this is the place to do something with the data based on
            console.dir(data, {depth: 9});

            // TODO: in future response may add some header to communicate back
            // some information about
            // - the collector
            // - the config
            // - something else
            // PS: maybe collector could be able to tell the sdk/distro to stop sending
            // because of: high load, sample rate changed, et al??
            res.writeHead(200);
            res.end(
                JSON.stringify({
                    ok: 1,
                })
            );
        });

        req.resume();
    });

    server.listen(port, hostname, function () {
        const addr = server.address();
        const endpoint =
            addr.family === 'IPv6'
                ? `http://[${addr.address}]:${addr.port}`
                : `http://${addr.address}:${addr.port}`;
        log.info(`OTLP/HTTP listening at ${endpoint}`);
    });
}

module.exports = {
    startHttp,
};
