# @elastic/mockopampserver Changelog

## Unreleased

- Add a `POST /api/agentConfigMap` API endpoint that is only supported if
  `testMode` is true. This is not an OpAMP endpoint. It exists to support
  dev/test changing the agent config on the fly. Example usage with curl:
        curl -i http://127.0.0.1:4320/api/agentConfigMap -F 'elastic={"logging_level":"debug"}'

- Drop `--json-remote-config-file` CLI option. in favour of more capable
  `-F` option. See example usage in `npm run example:*` scripts in package.json.

## v0.2.0

- Fix `publishConfig` for npm publishing.

## v0.1.0

Initial release.
