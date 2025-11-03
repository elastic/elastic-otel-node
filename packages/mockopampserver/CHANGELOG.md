# @elastic/mockopampserver Changelog

## v0.4.1

- Fix an edge case where the server could crash on receiving a AgentToServer
  with an `instance_uid` that could not be stringified to a valid UUID.

- Bump the OpAMP protobuf definitions to v0.14.0 (from v0.12.0).
  https://github.com/open-telemetry/opamp-spec/blob/main/CHANGELOG.md#v0140

## v0.4.0

- Expose `MockOpAMPServer#setAgentConfigMap(...)` method, for use in testing.
- chore: Excluding devDeps from Docker images should make them smaller.
- Fix an issue where Ctrl+C would not exit mockopampserver *when running the Docker image*.

## v0.3.0

- Add a `POST /api/agentConfigMap` API endpoint that is only supported if
  `testMode` is true. This is not an OpAMP endpoint. It exists to support
  dev/test changing the agent config on the fly. Example usage with curl:

        curl -i http://127.0.0.1:4320/api/agentConfigMap -F 'elastic={"logging_level":"debug"}'

- Drop `--json-remote-config-file` CLI option in favour of more capable
  `-F` option. See example usage in `npm run example:*` scripts in package.json.

## v0.2.0

- Fix `publishConfig` for npm publishing.

## v0.1.0

Initial release.
