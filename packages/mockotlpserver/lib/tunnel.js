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
const https = require('https');
/**
 * @param {import('./luggite').Logger} log
 * @param {string} target
 * @returns {((req: http.IncomingMessage, res: http.ServerResponse) => void) | undefined}
 */
function createHttpTunnel(log, target) {
    /** @type {URL} */
    let targetUrl;

    try {
        targetUrl = new URL(target);
    } catch {
        log.warn(`Cannot create a tunnel to target "${target}". The given URL is invalid.`);
        return;
    }

    const {protocol, host} = targetUrl;
    if (protocol !== 'http:' && protocol !== 'https:') {
        log.warn(`Cannot create a tunnel to target "${target}". Protocol must be one of: http, https.`);
        return;
    }

    const port = targetUrl.port || (protocol === 'http:' ? 80 : 443);
    return function httpTunnel(req, res) {
        // APM server does not support 'http/json' protocol
        // ref: https://www.elastic.co/guide/en/observability/current/apm-api-otlp.html
        const contentType = req.headers['content-type'];
        if (contentType !== 'application/x-protobuf') {
            log.warn(`Content type "${contentType}" may not be accepted by the target server (${target})`);
        }

        const httpFlavor = protocol === 'http:' ? http : https;
        const options = {
            host: targetUrl.host,
            port,
            method: req.method,
            headers: {...req.headers, host},
            path: req.url,
        };
        const tunnelReq = httpFlavor.request(options, (tunnelRes) => {
            tunnelRes.pipe(res);
        });
        req.pipe(tunnelReq);
    }
}

module.exports = {
    createHttpTunnel,
};
