/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const http = require('http');
const zlib = require('zlib');

const {create, toBinary, fromBinary} = require('@bufbuild/protobuf');

const {
    AgentToServerSchema,
    ServerToAgentSchema,
} = require('./generated/opamp_pb.js');
const {log} = require('./logging');

// Default hostname to 'localhost', because that is what `DEFAULT_COLLECTOR_URL`
// uses in the OTel core exporter packages. Note that 'localhost' can by IPv6
// '::1' or IPv4 '127.0.0.1', which can potentially cause confusion.
const DEFAULT_HOSTNAME = 'localhost';
// DEFAULT_PORT is close to the OTLP 4317 port, and currently unassigned
// https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.xhtml?&page=81
// This isn't a strong argument for using this port.
const DEFAULT_PORT = 4315;
const DEFAULT_URL_PATH = '/v1/opamp';

/**
 * @param {http.OutgoingMessage} res
 */
function respondHttpErr(res, errMsg = 'Bad Request', errCode = 400) {
    res.writeHead(errCode, {
        'Content-Type': 'text/plain',
    });
    res.end(errMsg);
}
function respondHttp404(res, errMsg = '404 page not found') {
    res.writeHead(404, {
        'Content-Type': 'text/plain',
    });
    res.end(errMsg);
}

class MockOpAMPServer {
    /**
     * @param {object} [opts]
     * @param {string} [opts.logLevel] Optionally change the log level. This
     *      accepts any of the log level names supported by luggite. Typically
     *      one would use opts.log *or* opts.logLevel. The latter enables
     *      tweaking the log level without having to pass in a custom logger.
     * @param {string} [opts.hostname]
     */
    constructor(opts) {
        opts = opts ?? {};
        if (opts.logLevel != null) {
            log.level(opts.logLevel);
        }

        this._hostname = opts.hostname ?? DEFAULT_HOSTNAME;
        this._port = DEFAULT_PORT;
        this._urlPath = DEFAULT_URL_PATH;
        this._urlBase = `http://${this._hostname}:${this._port}`;

        this._server = http.createServer((req, res) => {
            // Basic HTTP request validations.
            const u = new URL(req.url, this._urlBase);
            if (u.pathname !== this._urlPath) {
                respondHttp404(res);
                return;
            }
            if (
                req.method == 'GET' &&
                req.headers.connection?.trim()?.toLowerCase() == 'upgrade'
            ) {
                respondHttpErr(
                    res,
                    'Connection upgrade is not supported. mockapmserver does not implement the OpAMP WebSockets transport.',
                    501
                );
            }
            if (req.method !== 'POST') {
                // Not using HTTP 405, because a 'GET' will eventually be
                // allowed for connection upgrade to websocket.
                respondHttpErr(res);
                return;
            }
            if (req.headers['content-type'] !== 'application/x-protobuf') {
                respondHttpErr(
                    res,
                    `invalid Content-Type, expect "application/x-protobuf", got ${
                        req.headers['content-type'] ?? '<empty>'
                    }`
                );
                return;
            }

            // Handle possible gzip compression;
            let instream;
            // TODO: what was the other compression scheme Felix was trying that was faster? Brotli?
            switch (req.headers['content-encoding']) {
                case undefined:
                    instream = req;
                    break;
                case 'gzip':
                    instream = req.pipe(zlib.createGunzip());
                    break;
                default:
                    respondHttpErr(
                        res,
                        `unsupported Content-Encoding: ${req.headers['content-encoding']}`,
                        415
                    );
                    return;
            }
            if (req.headers['content-encoding'] === 'gzip') {
                instream = req.pipe(zlib.createGunzip());
            } else if (req.headers['content-encoding'] === 'deflate') {
                // Go agent uses "deflate"
                instream = req.pipe(zlib.createInflate());
            }

            const chunks = [];
            instream.on('data', (chunk) => chunks.push(chunk));
            instream.on('error', (err) => {
                log.warn(err, 'error on instream');
                respondHttpErr(res, err.message);
            });
            instream.on('end', () => {
                const reqBuffer = Buffer.concat(chunks);
                let a2s;
                try {
                    a2s = fromBinary(AgentToServerSchema, reqBuffer);
                } catch (err) {
                    log.info(err, 'deserialize AgentToServer error');
                    respondHttpErr(res, err.message);
                    return;
                }

                // TODO: check length of instanceUid
                // TODO: meaningful server handling ...
                const s2a = create(ServerToAgentSchema, {
                    instanceUid: a2s.instanceUid,
                    // ...
                });
                // TODO: compress if `Accept-Encoding: gzip`
                const resBody = toBinary(ServerToAgentSchema, s2a);
                res.writeHead(200, {
                    'Content-Type': 'application/x-protobuf',
                    'Content-Length': resBody.length,
                });
                res.end(resBody);

                req.body = a2s; // for logging 'req' serializer
                res.body = s2a; // for logging 'res' serializer
                log.info({req, res}, 'request');
            });
        });
    }

    async start() {
        return new Promise((resolve, reject) => {
            this._server.listen(this._port, this._hostname, () => {
                log.info(
                    `OpAMP server listening at http://${this._hostname}:${this._port}${this._urlPath}`
                );
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
}

module.exports = {
    DEFAULT_HOSTNAME,
    MockOpAMPServer,
};
