# @elastic/opamp-client-node

An Open Agent Management Protocol (OpAMP) client for Node.js.


## Current status

Still in development.


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
import {
    createOpAMPClient,
    AgentCapabilities,
} from '@elastic/opamp-client-node';

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

Usage more typical if used with an OpenTelemetry JS SDK which has a `Resource` with identifying attributes:

```js
import {
    createOpAMPClient,
    agentDescriptionFromResource,
} from '@elastic/opamp-client-node';

const resource = ...; // from OTel JS resource detectors
const client = createOpAMPClient({
    endpoint: 'http://localhost:4315/v1/opamp',
    onRemoteConfig: (remoteConfig) => {
        console.log('Got remote config:', remoteConfig);
    }
});
client.setAgentDescription(agentDescriptionFromResource(resource));
client.start();
process.once('beforeExit', () => { client.shutdown(); });

setInterval(() => {}, 10000); // Keep running.
```

TODO: ^^ impl agentDescriptionFromResource, test this usage


## Reference

TODO: most of the reference docs


### onMessage

Note: If the `ReportsRemoteConfig` capability was set, it is update to user
to call `client.setRemoteConfigStatus(...)` as appropriate.
(TODO: example of this)


## Limitations

- Only supports HTTP transport (no WebSocket transport).
- Supports only a subset of the spec: none of the Beta or Development features
  unless otherwise shown.
  TODO: be specific
