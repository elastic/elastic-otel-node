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
 * @param {http.IncomingMessage} req
 */
function proxyHttp(log, target, req) {
    /** @type {URL} */
    let targetUrl;

    try {
        targetUrl = new URL(target);
    } catch {
        log.warn(`Cannot proxy request to target "${target}". Invalid URL.`);
        return;
    }

    const {protocol, host} = targetUrl;
    if (protocol !== 'http:' && protocol !== 'https:') {
        log.warn(
            `Invalid protocol for proxy requests to "${target}". Valid protocols are: http, https.`
        );
        return;
    }

    const httpFlavor = protocol === 'http:' ? http : https;
    const proxyUrl = new URL(req.url, `${protocol}//${host}/`);
    const headers = {...req.headers};
    // XXX: missing how to pass this. discuss in meeting
    headers['authorization'] = 'Bearer XXXXX';
    delete headers.host;
    const options = {
        host,
        method: req.method,
        headers,
        path: proxyUrl.pathname,
        search: proxyUrl.search,
    };
    log.info(options, 'proxy request options');
    const proxyReq = httpFlavor.request(options, (res) => {
        log.info('proxy response callback received');
        const chunks = [];
        res.on('data', (chunk) => {
            log.info('chunk of proxy response');
            chunks.push(chunk);
        });
        res.on('end', () => {
            log.info('proxy response ended');
            log.info(Buffer.concat(chunks).toString('utf-8'));
        });
    });
    req.pipe(proxyReq);
}

module.exports = {
    proxyHttp,
};
