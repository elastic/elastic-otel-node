/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {test} = require('tape');
const uuid = require('uuid');
const {create, toBinary, fromBinary} = require('@bufbuild/protobuf');

const {
    AgentCapabilities,
    AgentToServerSchema,
    ServerToAgentSchema,
} = require('../lib/generated/opamp_pb');
const {MockOpAMPServer} = require('..');
const {keyValuesFromObj} = require('./testutils');

function genUuidv7() {
    const b = new Uint8Array(16);
    uuid.v7(null, b);
    return b;
}

function isEqualUint8Array(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

/**
 * Start a MockOpAMPServer, send some requests to it and assert on expected
 * responses.
 */
test('MockOpAMPServer', (suite) => {
    let opampServer;

    suite.test('setup', async (t) => {
        opampServer = new MockOpAMPServer({
            logLevel: 'warn', // use 'debug' for some debugging of the server
            hostname: '127.0.0.1',
            port: 0,
        });
        await opampServer.start();
        t.comment(`MockOpAMPServer started: ${opampServer.endpoint}`);
    });

    suite.test('simple AgentToServer', async (t) => {
        const instanceUid = genUuidv7();
        const a2s = create(AgentToServerSchema, {
            instanceUid,
            capabilities: AgentCapabilities.AgentCapabilities_ReportsStatus,
            sequenceNum: 1n,
            agentDescription: {
                identifyingAttributes: keyValuesFromObj({
                    foo: 'bar',
                }),
            },
        });

        const res = await fetch(opampServer.endpoint, {
            method: 'POST',
            body: toBinary(AgentToServerSchema, a2s),
            headers: {
                'Content-Type': 'application/x-protobuf',
            },
        });
        t.equal(res.status, 200);
        t.equal(res.headers.get('content-type'), 'application/x-protobuf');
        t.ok(res.headers.has('content-length'));
        // Slurp the response body. (A pain because res.bytes() was only added
        // in Node.js v22. Or could use undici.request().)
        const clen = Number(res.headers.get('content-length'));
        const resBody = new Uint8Array(clen);
        let offset = 0;
        for await (const chunk of res.body) {
            resBody.set(chunk, offset);
            offset += chunk.length;
        }

        const s2a = fromBinary(ServerToAgentSchema, resBody);
        t.ok(isEqualUint8Array(s2a.instanceUid, instanceUid));
        t.equal(s2a.flags, 0n, 'should not receive the ReportFullState flag');

        t.end();
    });

    suite.test('teardown', async (t) => {
        // Note that this test file will now hang for ~4s until Node's bundled
        // undici (used to implement `fetch()`) Keep-Alive timeout ends. I don't
        // know of a way to avoid that. Would like an equivalent to:
        //      undici.getGlobalDispatcher().close();
        t.comment('expected 4s hang for fetch() internal Keep-Alive timeout');

        if (opampServer) {
            await opampServer.close();
        }
    });

    suite.end();
});
