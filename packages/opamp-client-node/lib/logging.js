/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TODO: Type for LF4JS Logger. An idea for a (Node.)JS equivalent to https://www.slf4j.org/
 * My proposal is that it just has the emit-a-record methods that Bunyan and
 * Pino have, with the signature simplified to Pino's (which no longer takes
 * trailing arguments). Luggite should comply with this. OTel DiagLogger does
 * *not* out of the box because (a) `.verbose()` rather than `.trace()` and
 * (b) doesn't accept leading object/err argument. Would need a shim to
 * accept DiagLogger.
 */

class NoopLogger {
    trace() {}
    debug() {}
    info() {}
    error() {}
    warn() {}
    fatal() {}
}

module.exports = {
    NoopLogger,
};
