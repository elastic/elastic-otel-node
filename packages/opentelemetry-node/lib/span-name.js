/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Support for renaming spans at export time:
// - `ELASTIC_OTEL_USE_PATH_AS_SPAN_NAME` / `use_path_as_span_name`
// - `ELASTIC_OTEL_SPAN_NAME_GROUPS` / `span_name_groups`

const {SpanKind} = require('@opentelemetry/api');
const {
    ATTR_HTTP_REQUEST_METHOD,
    ATTR_HTTP_REQUEST_METHOD_ORIGINAL,
    ATTR_URL_PATH,
} = require('@opentelemetry/semantic-conventions');

/**
 * @typedef {import('@opentelemetry/sdk-trace').ReadableSpan} ReadableSpan
 */

// The span name used by HTTP server instrumentations following semconv when
// the request method is not a known one (`http.request.method` is `_OTHER`).
const UNKNOWN_METHOD_SPAN_NAME = 'HTTP';

/**
 * A case-sensitive matcher for patterns where `*` matches zero or more
 * characters. There is no escaping, so a pattern cannot match a literal `*`
 * other than via a wildcard.
 */
class WildcardMatcher {
    /**
     * @param {string} pattern
     */
    constructor(pattern) {
        this.pattern = pattern;
        this._segments = pattern.split('*');
    }

    /**
     * Returns whether `str` matches the pattern.
     *
     * The pattern is split on `*` into segments. `str` must start with the
     * first segment, end with the last one, and contain the segments in
     * between in order.
     *
     * @param {string} str
     * @returns {boolean}
     */
    matches(str) {
        // The first and last segment must match, and then we find inner segments
        // in between. If all the inner segments can be found, the wildcards match
        // the characters surrounding them.
        const segments = this._segments;
        const first = segments[0];
        if (segments.length === 1) {
            return str === first;
        }
        const last = segments[segments.length - 1];
        const end = str.length - last.length;
        if (
            end < first.length ||
            !str.startsWith(first) ||
            !str.endsWith(last)
        ) {
            return false;
        }
        let pos = first.length;
        for (let i = 1; i < segments.length - 1; i++) {
            const segment = segments[i];
            if (segment === '') {
                continue;
            }
            const idx = str.indexOf(segment, pos);
            if (idx === -1 || idx + segment.length > end) {
                return false;
            }
            pos = idx + segment.length;
        }
        return true;
    }
}

/**
 * Parse a comma-separated list of span name group patterns. Parsing mimics
 * `getStringListFromEnv`, which is used for `ELASTIC_OTEL_SPAN_NAME_GROUPS`.
 *
 * @param {string | undefined} str
 * @returns {string[]}
 */
function parseSpanNameGroups(str) {
    if (!str) {
        return [];
    }
    return str
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '');
}

/**
 * @param {ReadableSpan} span
 * @returns {string | undefined}
 */
function nameWithPath(span) {
    if (span.kind !== SpanKind.SERVER) {
        return undefined;
    }
    const method = span.attributes[ATTR_HTTP_REQUEST_METHOD];
    const path = span.attributes[ATTR_URL_PATH];
    if (typeof method !== 'string' || typeof path !== 'string') {
        return undefined;
    }
    // Without a route, HTTP server instrumentations name the span with just
    // the method: `@opentelemetry/instrumentation-http` uses the method as
    // received (`http.request.method_original` when it is not a known one),
    // semconv uses `HTTP` for unknown methods.
    const name = span.name;
    const hasGenericHttpName =
        name === method ||
        name === span.attributes[ATTR_HTTP_REQUEST_METHOD_ORIGINAL] ||
        name === UNKNOWN_METHOD_SPAN_NAME;
    if (!hasGenericHttpName) {
        return undefined;
    }
    return `${name} ${path}`;
}

/**
 * Return a span with the given name, preserving other properties of the span.
 *
 * @param {ReadableSpan} span
 * @param {string} name
 * @returns {ReadableSpan}
 */
function renamedSpan(span, name) {
    return Object.create(span, {
        name: {value: name, enumerable: true},
    });
}

/**
 * Renames spans according to the span naming settings.
 */
class SpanNamer {
    constructor() {
        this._usePath = false;
        /** @type {WildcardMatcher[]} */
        this._groups = [];
    }

    /**
     * @param {boolean} usePath
     */
    setUsePathAsSpanName(usePath) {
        this._usePath = usePath;
    }

    /**
     * @param {string[]} patterns
     */
    setSpanNameGroups(patterns) {
        this._groups = patterns.map((p) => new WildcardMatcher(p));
    }

    /**
     * @param {ReadableSpan[]} spans
     * @returns {ReadableSpan[]} The given array if no span was renamed,
     *      otherwise a new array.
     */
    rename(spans) {
        const usePath = this._usePath;
        const groups = this._groups;
        if (!usePath && groups.length === 0) {
            return spans;
        }
        let result = spans;
        for (let i = 0; i < spans.length; i++) {
            const newName = this._spanName(spans[i], usePath, groups);
            if (newName !== undefined) {
                if (result === spans) {
                    result = spans.slice();
                }
                result[i] = renamedSpan(spans[i], newName);
            }
        }
        return result;
    }

    /**
     * @param {ReadableSpan} span
     * @param {boolean} usePath
     * @param {WildcardMatcher[]} groups
     * @returns {string | undefined} The new name, if it changed.
     */
    _spanName(span, usePath, groups) {
        let name = span.name;
        let changed = false;
        if (usePath) {
            const pathName = nameWithPath(span);
            if (pathName !== undefined) {
                name = pathName;
                changed = true;
            }
        }
        for (let i = 0; i < groups.length; i++) {
            if (groups[i].matches(name)) {
                name = groups[i].pattern;
                changed = true;
                break;
            }
        }
        return changed ? name : undefined;
    }
}

module.exports = {
    WildcardMatcher,
    SpanNamer,
    parseSpanNameGroups,
};
