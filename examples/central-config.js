/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * An example using EDOT Node.js central configuration. This is where
 * a subset of the SDK's configuration settings can be controlled centrally
 * in Kibana.
 *
 * (Note: At time of writing this feature is still in development, so all
 * required components may not yet have releases.)
 *
 * # Usage
 *
 * 1. Ensure you are using an Elastic Cloud Hosted or on-prem Elastic of at
 *    least version 9.1.
 *
 * 2. Start an EDOT Collector configured to use the `apmconfig` extension:
 *    https://github.com/elastic/opentelemetry-collector-components/tree/main/extension/apmconfigextension#readme
 *    This extension implements an OpAMP server. OpAMP is the protocol used
 *    by EDOT to communicate remote configuration.
 *    (https://github.com/open-telemetry/opamp-spec/blob/main/specification.md)
 *
 * 3. Set `ELASTIC_OTEL_OPAMP_ENDPOINT=...` to tell the EDOT SDK to enable
 *    central config, and where to find the OpAMP server:

    ELASTIC_OTEL_OPAMP_ENDPOINT=localhost:4320 \
        ELASTIC_OTEL_EXPERIMENTAL_OPAMP_HEARTBEAT_INTERVAL=5000 \
        node --import @elastic/opentelemetry-node central-config.js

 * (Note: The `..._HEARTBEAT_INTERVAL` setting is used *for demonstration
 * purposes* to make the checking-for-remote-config more frequent. Typically
 * this setting should not be used -- to get the 30s default interval.)
 *
 * # Local dev usage:
 *
 * To see some OpAMP usage without Elastic and EDOT Collector deployments,
 * you can use the `mock*server` dev tools in this repo:
 *
 * 1. Start a mock OTLP server:
 *      cd packages/mockotlpserver
 *      npm ci
 *      npm start
 *
 * 2. Start a mock OpAMP server that will advertise a config with the 'elastic'
 *    filename that EDOT Node.js looks for:
 *      cd packages/mockopampserver
 *      npm ci
 *      npm run example:elastic-remote-config  # uses text/fixtures/agent-config.json
 *
 * 3. Start "central-config.js" with the command shown above.
 *    If this works you should see this in the log output:
 *
 *      ...
 *      {"name":"elastic-otel-node","level":30,"msg":"central-config: set \"logging_level\" to \"debug\"","time":"..."}
 *
 *    You could then change the OpAMP server to offer an empty config:
 *
 *      npm run example:elastic-empty-config
 *
 *    After which you should see this log output from "central-config.js" as
 *    it resets the config back to the default value:
 *
 *      ...
 *      {"name":"elastic-otel-node","level":30,"msg":"central-config: reset \"logging_level\" to \"info\"","time":"..."}
 */

const http = require('http');

const server = http.createServer(function onRequest(req, res) {
    console.log('\nincoming request: %s %s', req.method, req.url);
    req.resume();
    req.on('end', function () {
        const body = 'pong';
        res.writeHead(200, {
            'content-type': 'text/plain',
            'content-length': Buffer.byteLength(body),
        });
        res.end(body);
    });
});

async function makeReq() {
    const cres = await fetch('http://localhost:3000/');
    console.log('fetch response: status=%s', cres.status);
    const body = await cres.text();
    console.log('fetch body: %s', body);
}

server.listen(3000, function () {
    setInterval(async () => {
        await makeReq();
    }, 3000);
});
