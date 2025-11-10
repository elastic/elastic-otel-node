/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// This provides a `log` singleton Logger instance for this package.

const util = require('util');

const bunyan = require('bunyan');

const _globalThis = typeof globalThis === 'object' ? globalThis : global;
const _symLog = Symbol.for('mockopampserver.log');

function createLogger() {
    return bunyan.createLogger({
        name: 'mockopampserver',
        serializers: {
            err: bunyan.stdSerializers.err,
            req: function (req) {
                if (!req || !req.connection) return req;
                return {
                    method: req.method,
                    // Accept `req.originalUrl` for expressjs usage.
                    // https://expressjs.com/en/api.html#req.originalUrl
                    url: req.originalUrl || req.url,
                    headers: req.headers,
                    body:
                        req.body &&
                        util.inspect(req.body, {depth: 50, colors: true}),
                };
            },
            res: function (res) {
                if (!res || !res.statusCode) {
                    return res;
                }
                return {
                    statusCode: res.statusCode,
                    header: res._header,
                    body:
                        res.body &&
                        util.inspect(res.body, {depth: 50, colors: true}),
                };
            },
            agent: function (agent) {
                // `agent` is the data the mockopapmserver keeps on reporting
                // OpAMP clients. See `_processAgentToServer`. The main issue
                // is that it holds some BigInts, which JSON serializing balks
                // on.
                return util.inspect(agent, {depth: 50, colors: true});
            },
            sequenceNum: function (sequenceNum) {
                // Workaround Bunyan's geriatric serialization choking on
                // BigInts. This is, of course, a weak workaround.
                return util.inspect(sequenceNum);
            },
        },
        level: 'info',
        stream: process.stdout,
    });
}

// ---- main line

// Create, if necessary, and export a singleton `log` logger instance.
if (_globalThis[_symLog] === undefined) {
    _globalThis[_symLog] = createLogger();
}
/** @type {import('./luggite').Logger} */
const log = _globalThis[_symLog];

// ---- exports

module.exports = {
    log,
};
