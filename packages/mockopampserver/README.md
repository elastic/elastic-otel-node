# @elastic/mockopampserver

A mock Open Agent Management Protocol (OpAMP, https://github.com/open-telemetry/opamp-spec)
server for development and testing.  The intent is that this is something useful
to maintainers of OpAMP clients, especially for Elastic's Node.js OpAMP client
(package `@elastic/opamp-client-node`).

Features:
- It is a Node.js server (this may or may not be a feature to you :)
- It supports the OpAMP HTTP transport.
- Remote config (i.e. the `OffersRemoteConfig` server capability).
- It logs the received `AgentToServer` and sent `ServerToAgent` protobuf messages in a somewhat readable format.
- A way to use this in Node.js testing (see `testMode: true` and `test*` methods). See example usage in "packages/opamp-client-node/test/...".
- "Bad mode": the `MockOpAMPServer` can be configured to be in one of a number of "bad modes" where it responds in an atypical way, to support testing error cases / failure modes. See `badMode` usages in "packages/opamp-client-node/test/client.test.js".

Limitations:
- It only supports the HTTP transport of OpAMP, not the [WebSocket Transport](https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#websocket-transport). (The spec says "Server implementations SHOULD accept both plain HTTP connections and WebSocket connections.")
- Most of the optional server capabilities are not implemented: effective config, packages, connection settings, command, custom capabilities.


## Usage

### CLI usage with Docker

Releases of mockopampserver include published Docker images. You can start a server via:

```
docker run --rm -it -p 4320:4320 --name mockopampserver \
    ghcr.io/elastic/elastic-otel-node/mockopampserver:latest
```

### CLI usage with npx

If you use `npx`, you can start a server via:

```bash
npx @elastic/mockopampserver
```

### CLI usage from the repository

To build and use the server from this repository:

```
cd packages/mockopampserver
npm ci
npm start
```

Once the server is started, you can use it with an OpAMP client. For example:

```
cd ../packages/opamp-client-node
npm ci
npm run example
```

Or, if you don't have a particular OpAMP client to use, you can try sending a request via `curl` using the included simple `AgentToServer` protobuf file:

```
curl -si http://localhost:4320/v1/opamp -X POST \
    -H content-type:application/x-protobuf \
    --data-binary @./test/fixtures/AgentToServer.simple.bin \
    | ./scripts/ServerToAgent
```

(The [`ServerToAgent`](./scripts/ServerToAgent) script will deserialize [opamp.proto.ServerToAgent`](https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#servertoagent-message) binary content on stdin and dump a representation to stdout.)

### Module usage

See the block comment for [`class MockOpAMPServer`](./lib/mockopampserver.js#:~:text=class%20MockOpAMPServer) for docs on all config options.

Here is an example showing how MockOpAMPServer could be used in a JS test case:

```js
const {MockOpAMPServer} = require('@elastic/mockopampserver');

test('some OpAMP client test', async (t) => {
    opampServer = new MockOpAMPServer({
        logLevel: 'warn', // use 'debug' for some debugging of the server
        hostname: '127.0.0.1',
        port: 0,
        testMode: true,
    });
    await opampServer.start();
    t.comment(`MockOpAMPServer started: ${opampServer.endpoint}`);

    // Reset test data in the OpAMP server for each test, if re-using the same
    // mock server for multiple tests.
    opampServer.testReset();

    // Use an OpAMP client with `opampServer.endpoint`.
    // ...

    // Get details of every request/response from the server's point of view.
    // Each entry can include the following fields:
    // - `req`: some fields from the incoming HTTP request
    // - `res`: some fields from the outgoing HTTP response
    // - `a2s`: the parsed AgentToServer protobuf object sent by the client
    // - `s2a`: the parsed ServerToAgent protobuf object sent by the server
    // - `err`: an Error instance, in some failure cases
    const reqs = opampServer.testGetRequests();
    // console.dir(reqs, {depth: 50});
});
```

An example "test request" object:

```js
[
  {
    req: {
      method: 'POST',
      headers: {
        host: '127.0.0.1:51204',
        connection: 'keep-alive',
        'user-agent': '@elastic/opamp-client-node/0.1.0',
        'content-type': 'application/x-protobuf',
        'content-length': '39'
      }
    },
    res: {
      statusCode: 200,
      _header: 'HTTP/1.1 200 OK\r\n' +
        'Content-Type: application/x-protobuf\r\n' +
        'Content-Length: 20\r\n' +
        'Date: Tue, 27 May 2025 21:49:36 GMT\r\n' +
        'Connection: keep-alive\r\n' +
        'Keep-Alive: timeout=5\r\n' +
        '\r\n'
    },
    a2s: {
      '$typeName': 'opamp.proto.AgentToServer',
      instanceUid: Buffer(16) [Uint8Array] [
          1, 151,  19, 184, 240, 118,
        118, 159, 172,  57,  91,  52,
         29, 167,  17,  41
      ],
      sequenceNum: 1n,
      capabilities: 8193n,
      flags: 0n,
      agentDescription: {
        '$typeName': 'opamp.proto.AgentDescription',
        identifyingAttributes: [
          {
            '$typeName': 'opamp.proto.KeyValue',
            key: 'foo',
            value: {
              '$typeName': 'opamp.proto.AnyValue',
              value: { case: 'stringValue', value: 'bar' }
            }
          }
        ],
        nonIdentifyingAttributes: []
      }
    },
    s2a: {
      '$typeName': 'opamp.proto.ServerToAgent',
      instanceUid: Buffer(16) [Uint8Array] [
          1, 151,  19, 184, 240, 118,
        118, 159, 172,  57,  91,  52,
         29, 167,  17,  41
      ],
      flags: 0,
      capabilities: 3
    },
    err: undefined
  }
]
```

### Remote config

Remote config is an important use case for OpAMP. Here is how it can be used
with MockOpAMPServer.

The CLI supports a `-F key=./some-file.json` option. This will
setup the mock server to offer that file as remote config to requesting
clients/agents, resulting in a server response with:

```
      ...
      remoteConfig: {
        '$typeName': 'opamp.proto.AgentRemoteConfig',
        configHash: Uint8Array(32) [ ... ],
        config: {
          '$typeName': 'opamp.proto.AgentConfigMap',
          configMap: {
            'key': {                            // <--- given "key" is here
              '$typeName': 'opamp.proto.AgentConfigFile',
              body: Uint8Array(...) [ ... ],    // <--- content of ./some-file.json is here
              contentType: 'application/json'
            }
          }
        }
      }
```

To see an example:

```
# Run the server with config.
cd packages/mockopampserver
npm run example:remote-config

# Run the client.
cd packages/opamp-client-node
npm run example
```

The equivalent setup of the server in code is:

```js
    const config = {foo: 42};
    const opampServer = new MockOpAMPServer({
        agentConfigMap: {
            configMap: {
                '': {
                    contentType: 'application/json',
                    body: Buffer.from(JSON.stringify(config), 'utf8'),
                },
            },
        },
        // ... other config options.
    });
    await opampServer.start();
```

### Test mode API to live-update agent config

In addition to the `agentConfigMap` constructor option, the MockOpAMPServer
supports a `POST /api/agentConfigMap` HTTP endpoint to update the Agent Config
that the server will use. This endpoint is *not* part of the OpAMP spec. The
endpoint is only enabled when `testMode: true`.

Here are some `curl` examples showing how to live-update the Agent Config
offered by a running MockOpAMPServer

```bash
# Set `logging_level` for the "elastic" configMap key.
curl -i http://127.0.0.1:4320/api/agentConfigMap -F 'elastic={"logging_level":"debug"}'

# Set empty config for the "elastic" key.
curl -i http://127.0.0.1:4320/api/agentConfigMap -F 'elastic={}'

# Set the config to the contents of a local JSON file.
curl -i http://127.0.0.1:4320/api/agentConfigMap -F 'elastic=@./my-agent-config.json'
```

See `SetAgentConfigMap` in ["lib/mockopampserver.js"](./lib/mockopampserver.js) for more examples.
