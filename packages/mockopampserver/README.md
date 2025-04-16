# @elastic/mockopampserver

A mock Open Agent Management Protocol (OpAMP) server for development and testing.
https://github.com/open-telemetry/opamp-spec

The intent is that this is something useful to maintainers of OpAMP clients,
especially for the Elastic's coming Node.js OpAMP client. However,

**Current status:** It can accept a AgentToServer and respond with a minimal ServerToAgent.
It does not do meaningful server handling.

## Usage

Start the mockopampserver:

```
npm install
npm start
```

Then call it with an OpAMP client, or this example curl request:

```
curl -si http://localhost:4315/v1/opamp -X POST \
    -H content-type:application/x-protobuf \
    --data-binary @./test/fixtures/AgentToServer.simple.bin \
    | ./scripts/ServerToAgent
```

(The [`ServerToAgent`](./scripts/ServerToAgent) script will deserialize [opamp.proto.ServerToAgent`](https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#servertoagent-message) binary content on stdin and dump a representation to stdout.)


## Limitations

- (mostly everything)

- Does not support the [WebSocket Transport](https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#websocket-transport). Only the Plain HTTP Transport is supported. The spec says:

    > Server implementations SHOULD accept both plain HTTP connections and WebSocket connections.


# Dev Notes

```
npm run watch

curl -si http://localhost:4315/v1/opamp -X POST \
    -H content-type:application/x-protobuf \
    --data-binary @./test/fixtures/AgentToServer.simple.bin \
    | ./scripts/ServerToAgent

curl -si http://localhost:4315/v1/opamp -X POST \
    -H content-type:application/x-protobuf \
    --data-binary @./test/fixtures/AgentToServer.bogus.bin \
    | ./scripts/ServerToAgent
```


