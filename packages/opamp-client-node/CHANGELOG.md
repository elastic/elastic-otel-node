# @elastic/opamp-client-node Changelog

## Unreleased

- Be more defensive in handling the `heartbeatIntervalSeconds` option: clamp to
  `[100ms, 1d]` and use the default (30s) for invalid values. The previous
  behaviour was to throw on invalid values, and to not have a max value.

## v0.2.0

- Publish types.

## v0.1.0

Initial release.
