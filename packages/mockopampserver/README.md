# @elastic/mockopampserver

A mock Open Agent Management Protocol (OpAMP, https://github.com/open-telemetry/opamp-spec)
server for development and testing.  The intent is that this is something useful
to maintainers of OpAMP clients, especially for the Elastic's coming Node.js
OpAMP client (package `@elastic/opamp-client-node`).

Features:
- It is a Node.js server (this may or may not be a feature to you :)
- It supports the OpAMP HTTP transport.
- It supports the minimal OpAMP capabilities, plus the `OffersRemoteConfig` server capability.
- It logs the received `AgentToServer` and sent `ServerToAgent` protobuf messages in a somewhat readable format.
- A way to use this in Node.js testing (see `testMode: true` and `test*` methods). See example usage in "packages/opamp-client-node/test/...".

Limitations:
- It only supports the HTTP transport of OpAMP, not the [WebSocket Transport](https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#websocket-transport). (The spec says "Server implementations SHOULD accept both plain HTTP connections and WebSocket connections.").
- Most of the optional server capabilities are not implemented: effective config, packages, connection settings, command, custom capabilities.

Planned features:
- "Bad" options so the server *misbehaves*, to support testing error handling of OpAMP clients.

## Usage

Start the mockopampserver:

```
npm ci
npm start
```

Then call it with an OpAMP client. For example:

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


## Reference

TODO: describe `badMode: ...`

