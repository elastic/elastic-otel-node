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

const fs = require('fs');
const path = require('path');
const http = require('http');

const {Service} = require('./service');

// helper functions

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

class UiService extends Service {
    /**
     * @param {Object} opts
     * @param {import('./luggite').Logger} opts.log
     * @param {string} opts.hostname
     * @param {number} opts.port
     */
    constructor(opts) {
        super();
        this._opts = opts;
        this._server = null;
    }

    async start() {
        const {hostname, port} = this._opts;
        const assetsPath = path.resolve(__dirname, '../ui');
        const dataPath = path.resolve(__dirname, '../db');
        this._server = http.createServer((req, res) => {
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
                    const sortedFiles = traceFiles.sort((fileA, fileB) => {
                        const statA = fs.statSync(`${dataPath}/${fileA}`);
                        const statB = fs.statSync(`${dataPath}/${fileB}`);

                        return new Date(statA.birthtime).getTime() - new Date(statB.birthtime).getTime();
                    });

                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify(sortedFiles));
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
    UiService,
};
