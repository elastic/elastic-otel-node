/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Setting the User-Agent for exporters created by EDOT Node.js.
//
// Eventually the upstream exporters will support an option for this
// (see https://github.com/elastic/elastic-otel-node/issues/431). The
// monkey-patching done in this file are a temporary measure.

const {log} = require('./logging');

// @ts-ignore - compiler options do not allow lookup outside `lib` folder
const VERSION = require('../package.json').version;
const EDOT_USER_AGENT_HTTP = `elastic-otlp-http-javascript/${VERSION}`;
// const EDOT_USER_AGENT_GRPC = `elastic-otlp-grpc-javascript/${VERSION}`;

function setUserAgentOnOTLPTransport(transport) {
    switch (transport.constructor.name) {
        case 'RetryingTransport': {
            // HTTP:
            // OTLPTraceExporter {
            //   _delegate: OTLPExportDelegate {
            //     _transport: RetryingTransport {
            //       _transport: [HttpExporterTransport]
            const httpReqParams = transport._transport?._parameters;
            if (typeof httpReqParams?.headers === 'function') {
                const headersFn = httpReqParams.headers;
                httpReqParams.headers = () => {
                    const hdrs = headersFn();
                    hdrs['User-Agent'] =
                        `${EDOT_USER_AGENT_HTTP} ${hdrs['User-Agent']}`.trimEnd();
                    return hdrs;
                };
            }
            break;
        }

        // This overriding metadata is insufficient, because grpc-js
        // overwrites metadata['User-Agent'] from client options.
        // TODO: upstream PR for otlp-grpc-exporter-base to allow setting `grpc.primary_user_agent` and/or `grpc.secondary_user_agent` client options.
        // case 'GrpcExporterTransport': {
        //     // gRPC:
        //     // OTLPTraceExporter {
        //     //   _delegate: OTLPExportDelegate {
        //     //     _transport: GrpcExporterTransport {
        //     const metadataFn = transport._parameters?.metadata;
        //     if (typeof metadataFn === 'function') {
        //         transport._parameters.metadata = () => {
        //             /** @type {import('@grpc/grpc-js').Metadata} */
        //             const md = metadataFn();
        //             md.set('User-Agent', EDOT_USER_AGENT_GRPC);
        //             return md;
        //         };
        //     }
        //     break;
        // }

        default:
            log.debug(
                `cannot set an Elastic User-Agent on "${transport.constructor.name}" transport class`
            );
    }
}

module.exports = {
    setUserAgentOnOTLPTransport,
};
