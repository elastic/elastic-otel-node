/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Setting the User-Agent for exporters created by EDOT Node.js.
//
// Doing the patch of the `userAgent` property allows us to prepend the
// EDOT Node.js value to all exporters regardless if they were provided
// in configuration by the user.

const {log} = require('./logging');

// @ts-ignore - compiler options do not allow lookup outside `lib` folder
const VERSION = require('../package.json').version;
const EDOT_USER_AGENT_HTTP = `elastic-otlp-http-javascript/${VERSION}`;
const EDOT_USER_AGENT_GRPC = `elastic-otlp-grpc-javascript/${VERSION}`;

function setUserAgentOnOTLPTransport(transport) {
    switch (transport.constructor.name) {
        case 'RetryingTransport': {
            // HTTP:
            // OTLPTraceExporter {
            //   _delegate: OTLPExportDelegate {
            //     _transport: RetryingTransport {
            //       _transport: [HttpExporterTransport]
            const httpReqParams = transport._transport?._parameters;

            if (httpReqParams) {
                if (typeof httpReqParams.userAgent === 'string') {
                    httpReqParams.userAgent = `${EDOT_USER_AGENT_HTTP} ${httpReqParams.userAgent}`;
                } else {
                    httpReqParams.userAgent = EDOT_USER_AGENT_HTTP;
                }
            }
            break;
        }

        case 'GrpcExporterTransport': {
            // gRPC:
            // OTLPTraceExporter {
            //   _delegate: OTLPExportDelegate {
            //     _transport: GrpcExporterTransport {
            const grpcParameters = transport._parameters;
            if (typeof grpcParameters.userAgent === 'string') {
                grpcParameters.userAgent = `${EDOT_USER_AGENT_GRPC} ${grpcParameters.userAgent}`;
            } else {
                grpcParameters.userAgent = EDOT_USER_AGENT_GRPC;
            }
            break;
        }

        default:
            log.debug(
                `cannot set an Elastic User-Agent on "${transport.constructor.name}" transport class`
            );
    }
}

module.exports = {
    setUserAgentOnOTLPTransport,
};
