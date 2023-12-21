const http = require('http');
const path = require('path');

const protobuf = require('protobufjs');

const {
    diagchGet,
    CH_OTLP_V1_LOGS,
    CH_OTLP_V1_METRICS,
    CH_OTLP_V1_TRACE,
} = require('./diagch');

const parsersMap = {
    'application/json': jsonParser,
    'application/x-protobuf': protoParser,
};

function diagChFromReqUrl(reqUrl) {
    switch (reqUrl) {
        case '/v1/traces':
            return diagchGet(CH_OTLP_V1_TRACE);
        case '/v1/metrics':
            return diagchGet(CH_OTLP_V1_METRICS);
        case '/v1/logs':
            return diagchGet(CH_OTLP_V1_LOGS);
        default:
            return null;
    }
}

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
 * @param {import('./luggite').LoggerInstance} _log
 * @param {Buffer} buff
 * @param {http.IncomingMessage} _req
 */
function jsonParser(_log, buff, _req) {
    const reqText = buff.toString('utf-8');

    // NOTE: check for bignums
    return JSON.parse(reqText);
}

/**
 * @param {import('./luggite').LoggerInstance} _log
 * @param {Buffer} buff
 * @param {http.IncomingMessage} req
 */
function protoParser(_log, buff, req) {
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
    return null;
}

/**
 *
 * @param {import('./luggite').LoggerInstance} log
 * @param {Buffer} _buff
 * @param {http.IncomingMessage} req
 */
function unknownParser(log, _buff, req) {
    const contentType = req.headers['content-type'];
    log.warn(
        {contentType},
        `cannot parse ${req.url} request: unknown content-type`
    );
}

/**
 *
 * @param {Object} opts
 * @param {import('./luggite').LoggerInstance} opts.log
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

            // TODO: in future response may add some header to communicate back
            // some information about
            // - the collector
            // - the config
            // - something else
            // PS: maybe collector could be able to tell the sdk/distro to stop sending
            // because of: high load, sample rate changed, et al??
            res.writeHead(200);
            res.end(
                // TODO: return a response based on the service proto file if needed (check if the properties are camelCase)
                // PS: probably the partial_success is optional and we could send an empty object back
                // - logs { partial_success? { rejected_log_records: number; error_message?: string } }
                // - metrics { partial_success? { rejected_data_points: number; error_message?: string } }
                // - traces { partial_success? { rejected_spans: number; error_message?: string } }
                JSON.stringify({
                    ok: 1,
                })
            );

            // We publish into diagnostics channel after returning a response to the client to avoid not returning
            // a response if one of the handlers throws (the hanlders run synchronously in the
            // same context).
            // https://nodejs.org/api/diagnostics_channel.html#channelpublishmessage
            // TODO: maybe surround with try/catch to not blow up the server?
            const contentType = req.headers['content-type'];
            const parseData = parsersMap[contentType] || unknownParser;
            const reqBuffer = Buffer.concat(chunks);
            const reqUrl = req.url;
            const data = parseData(log, reqBuffer, req);
            const diagCh = diagChFromReqUrl(reqUrl);
            if (!data) {
                log.warn({contentType, reqUrl}, 'do not know how to parse req');
            } else if (!diagCh) {
                log.warn({reqUrl}, 'could not find diagnostic channel for req');
            } else {
                diagCh.publish(data);
            }
        });

        req.resume();
    });

    server.listen(port, hostname, function () {
        // /** @type {import('net').AddressInfo} */
        // TODO: the api retours string | AddressInfo
        // we should cover this case and use type assertions
        /** @type {any} */
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
