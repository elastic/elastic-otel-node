# @elastic/opamp-client-node

An Open Agent Management Protocol (OpAMP) client for Node.js.

## Current status

Vapourware. Still in development.



## Usage

Minimally:

```js
import {createOpAMPClient} from '@elastic/opamp-client-node';

const client = createOpAMPClient({
    endpoint: 'http://localhost:4315/v1/opamp', // mockopampserver default endpoint
});
client.setAgentDescription({
    identifyingAttributes: {
        'service.name': 'minimal-example',
    },
});
client.start();

setInterval(() => {}, 10000); // Keep running.
```

Using remote config:

```js
import {createOpAMPClient} from '@elastic/opamp-client-node';

const client = createOpAMPClient({
    endpoint: 'http://localhost:4315/v1/opamp', // mockopampserver default endpoint
    capabilities:
        AgentCapabilities.AgentCapabilities_AcceptsRemoteConfig |
        AgentCapabilities.AgentCapabilities_ReportsRemoteConfig,
    onMessage: ({remoteConfig}) => {
        if (remoteConfig) {
            console.log('Got remote config:', remoteConfig);
        }
    },
});
client.setAgentDescription({
    identifyingAttributes: {
        'service.name': 'minimal-example',
    },
});
client.start();

setInterval(() => {}, 10000); // Keep running.
```

XXX
		Capabilities: protobufs.AgentCapabilities_AgentCapabilities_AcceptsRemoteConfig |
			protobufs.AgentCapabilities_AgentCapabilities_ReportsRemoteConfig |
			protobufs.AgentCapabilities_AgentCapabilities_ReportsEffectiveConfig |
			protobufs.AgentCapabilities_AgentCapabilities_ReportsOwnMetrics |
			protobufs.AgentCapabilities_AgentCapabilities_AcceptsOpAMPConnectionSettings,

Usage more typical if used with an OpenTelemetry JS SDK which has a `Resource` with identifying attributes:

```js
import {
    createOpAMPClient,
    uuidBytesFromString,
    agentDescriptionFromResource,
} from '@elastic/opamp-client-node';

const res = ...; // from OTel JS resource detectors
const instId = res.attributes['service.instance.id'];
const client = createOpAMPClient({
    endpoint: 'http://localhost:4315/v1/opamp',
    instanceUid: instId && uuidBytesFromString(instId),
    onRemoteConfig: (remoteConfig) => {
        console.log('Got remote config:', remoteConfig);
    }
});
client.setAgentDescription(agentDescriptionFromResource(res));
client.start();
// XXX do we need shutdown for anything? WS transport does, but

setInterval(() => {}, 10000); // Keep running.
```


## Reference

TODO: most of the reference


### onMessage

Note: If the `ReportsRemoteConfig` capability was set, it is update to user
to call `client.setRemoteConfigStatus(...)` as appropriate.
(TODO: example of this)


## Limitations

- Only supports HTTP transport (no WebSocket transport).
- Supports only a subset of the spec: none of the Beta or Development features
  unless otherwise shown.
