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

const http = require('http');

const {
    diagchGet,
    CH_OTLP_V1_LOGS,
    CH_OTLP_V1_METRICS,
    CH_OTLP_V1_TRACE,
} = require('./diagch');
const {getProtoRoot} = require('./proto');
const {Service} = require('./service');
const {createHttpTunnel} = require('./tunnel');

const protoRoot = getProtoRoot();

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

// helper functions
function badRequest(
    res,
    errMsg = 'Invalid or no data received',
    errCode = 400
) {
    res.writeHead(400);
    res.end(
        JSON.stringify({
            error: {
                code: errCode,
                message: errMsg,
            },
        })
    );
}

/**
 * @param {import('./luggite').Logger} _log
 * @param {Buffer} buff
 * @param {http.IncomingMessage} _req
 */
function jsonParser(_log, buff, _req) {
    const reqText = buff.toString('utf-8');

    // NOTE: check for bignums
    return JSON.parse(reqText);
}

/**
 * @param {import('./luggite').Logger} _log
 * @param {Buffer} buff
 * @param {http.IncomingMessage} req
 */
function protoParser(_log, buff, req) {
    const pkgPrefix = 'opentelemetry.proto.collector';
    let decoder;
    if (req.url === '/v1/logs') {
        decoder = protoRoot.lookupType(
            `${pkgPrefix}.logs.v1.ExportLogsServiceRequest`
        );
    } else if (req.url === '/v1/metrics') {
        decoder = protoRoot.lookupType(
            `${pkgPrefix}.metrics.v1.ExportMetricsServiceRequest`
        );
    } else if (req.url === '/v1/traces') {
        decoder = protoRoot.lookupType(
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
 * @param {import('./luggite').Logger} log
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

class HttpService extends Service {
    /**
     * @param {Object} opts
     * @param {import('./luggite').Logger} opts.log
     * @param {string} opts.hostname
     * @param {number} opts.port
     * @param {string} [opts.tunnel]
     */
    constructor(opts) {
        super();
        this._opts = opts;
        this._server = null;
    }

    async start() {
        const {log, hostname, port, tunnel} = this._opts;
        const httpTunnel = tunnel && createHttpTunnel(log, tunnel);

        console.log('tunnel', httpTunnel)
        this._server = http.createServer((req, res) => {
            const contentType = req.headers['content-type'];

            // Tunnel requests if defined or validate otherwise
            if (httpTunnel) {
                httpTunnel(req, res);
            } else if (!parsersMap[contentType]) {
                return badRequest(
                    res,
                    `unexpected request Content-Type: "${contentType}"`
                );
            }

            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => {
                // Provide a response if there is no tunnel
                if (!httpTunnel) {
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
                    let resBody = null;
                    if (contentType === 'application/json') {
                        resBody = JSON.stringify({
                            ok: 1,
                        });
                    }
                    res.writeHead(200);
                    res.end(resBody);
                }

                // We publish into diagnostics channel after returning a response to the client to avoid not returning
                // a response if one of the handlers throws (the hanlders run synchronously in the
                // same context).
                // https://nodejs.org/api/diagnostics_channel.html#channelpublishmessage
                // TODO: maybe surround with try/catch to not blow up the server?
                const parseData = parsersMap[contentType] || unknownParser;
                const reqBuffer = Buffer.concat(chunks);
                const reqUrl = req.url;
                const data = parseData(log, reqBuffer, req);
                const diagCh = diagChFromReqUrl(reqUrl);
                if (!data) {
                    log.warn(
                        {contentType, reqUrl},
                        'do not know how to parse req'
                    );
                } else if (!diagCh) {
                    log.warn(
                        {reqUrl},
                        'could not find diagnostic channel for req'
                    );
                } else {
                    diagCh.publish(data);
                }
            });

            req.resume();
        });

        return new Promise((resolve, reject) => {
            this._server.listen(port, hostname, () => {
                resolve();
            });
            this._server.on('error', reject);
        });
    }

    async close() {
        if (this._server) {
            return new Promise((resolve, reject) => {
                this._server.close((err) => {
                    err ? reject(err) : resolve();
                });
            });
        }
    }

    get url() {
        const addr = this._server.address();
        if (addr === null) {
            return null;
        } else if (typeof addr === 'string') {
            return new URL(addr);
        }
        return new URL(
            [6, 'IPv6'].includes(addr.family)
                ? `http://[${addr.address}]:${addr.port}`
                : `http://${addr.address}:${addr.port}`
        );
    }
}

module.exports = {
    HttpService,
};
