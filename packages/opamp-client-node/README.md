# @elastic/opamp-client-node

An Open Agent Management Protocol (OpAMP) client for Node.js.

## Usage

The minimal usage of this OpAMP client is something like this:

```js
import {createOpAMPClient} from '@elastic/opamp-client-node';

const client = createOpAMPClient({endpoint: 'http://localhost:4320/v1/opamp'});
client.setAgentDescription({
    identifyingAttributes: { 'service.name': 'minimal-example' },
});
client.start();

process.on('beforeExit', async () => {
    await client.shutdown();
});

// ...
```

### Usage with remote config

Here is how to use the OpAMP client with the optional [OpAMP agent configuration support](https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#configuration):

```js
import {
    createOpAMPClient,
    AgentCapabilities,
    RemoteConfigStatuses
} from '@elastic/opamp-client-node';

const client = createOpAMPClient({
    endpoint: 'http://localhost:4320/v1/opamp',
    capabilities:
        AgentCapabilities.AgentCapabilities_AcceptsRemoteConfig |
        AgentCapabilities.AgentCapabilities_ReportsRemoteConfig,
    onMessage: ({remoteConfig}) => {
        if (remoteConfig) {
            console.log('Got remote config:', remoteConfig);

            // Apply the remote config.
            // ...

            // Report the remote config status.
            client.setRemoteConfigStatus({
                status: RemoteConfigStatuses.RemoteConfigStatuses_APPLIED,
                lastRemoteConfigHash: remoteConfig.configHash,
            });
        }
    },
});
client.setAgentDescription({
    identifyingAttributes: { 'service.name': 'minimal-example' },
});
client.start();

process.on('beforeExit', async () => {
    await client.shutdown();
});

// ...
```

### Using an OpenTelemetry resource for AgentDescription

The OpAMP client requires an [`AgentDescription`](https://github.com/open-telemetry/opamp-spec/blob/main/specification.md#agentdescription-message) to run. What data is included in this description is up to the user, but the OpAMP spec has some recommendations on what Semantic Conventions [resource attributes](https://opentelemetry.io/docs/concepts/resources/) "SHOULD" be included.

Here is some code that gathers those recommended attributes from an [OpenTelemetry JavaScript `Resource`](https://opentelemetry.io/docs/languages/js/resources/):

```js
/**
 * Copy properties from `fromObj` to `toObj` that match the given name
 * patterns (`namePats`). This is a shallow copy.
 *
 * `namePats` supports an extremely limited subset of glob matching: if a
 * pattern ends with an asterisk (`*`), then the rest of string is compared
 * with `.startsWith()`. For example `cloud.*` matches a 'cloud.foo' property
 * of `fromObj`. Otherwise the pattern uses an exact match.
 */
function pickProps(toObj, fromObj, namePats) {
    const fromKeys = Object.keys(fromObj)
    for (let namePat of namePats) {
        if (namePat.endsWith('*')) {
            const prefix = namePat.slice(0, -1);
            for (let k of fromKeys) {
                if (k.startsWith(prefix)) {
                    toObj[k] = fromObj[k];
                }
            }
        } else {
            if (namePat in fromObj) {
                toObj[namePat] = fromObj[namePat];
            }
        }
    }
    return toObj;
};

const resource = ...;
const client = createOpAMPClient(...);

await resource?.waitForAsyncAttributes();
client.setAgentDescription({
    identifyingAttributes: pickProps({}, resource.attributes, [
        'service.name', 'service.namespace', 'service.version',
        'service.instance.id',
    ]
    nonIdentifyingAttributes: pickProps({}, resource.attributes, [
        'os.type', 'os.version',
        'host.*',
        'cloud.*',
    ]
});

// ...
```


## Reference

TODO: most of the reference docs

### onMessage

Note: If the `ReportsRemoteConfig` capability was set, it is update to user
to call `client.setRemoteConfigStatus(...)` as appropriate.
(TODO: example of this)

TODO: more detail on using remote config
    - onMessage shouldn't throw
    - should handle multiple calls with dupe data: e.g. use remoteConfig.configHash
      to reduce work. They should be processed *serially*. I.e. for node.js the
      configHash check should be sync.
    - mention how to set status APPLIED and FAILED if surprised by the config
        - this requires setting the ReportsRemoteConfig capability
    - perhaps utility for single JSON config.

### diagEnabled

TODO: doc this, mark as experimental unpromised msg structure


## Limitations

- Only supports HTTP transport (no WebSocket transport).
- Supports only a subset of the spec: none of the Beta or Development features
  unless otherwise shown. TODO: be specific

