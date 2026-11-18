export type ReadableSpan = import('@opentelemetry/sdk-trace').ReadableSpan;
/**
 * A case-sensitive matcher for patterns where `*` matches zero or more
 * characters. There is no escaping, so a pattern cannot match a literal `*`
 * other than via a wildcard.
 */
export class WildcardMatcher {
    /**
     * @param {string} pattern
     */
    constructor(pattern: string);
    pattern: string;
    _segments: string[];
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
    matches(str: string): boolean;
}
/**
 * Renames spans according to the span naming settings.
 */
export class SpanNamer {
    _usePath: boolean;
    /** @type {WildcardMatcher[]} */
    _groups: WildcardMatcher[];
    /**
     * @param {boolean} usePath
     */
    setUsePathAsSpanName(usePath: boolean): void;
    /**
     * @param {string[]} patterns
     */
    setSpanNameGroups(patterns: string[]): void;
    /**
     * @param {ReadableSpan[]} spans
     * @returns {ReadableSpan[]} The given array if no span was renamed,
     *      otherwise a new array.
     */
    rename(spans: ReadableSpan[]): ReadableSpan[];
    /**
     * @param {ReadableSpan} span
     * @param {boolean} usePath
     * @param {WildcardMatcher[]} groups
     * @returns {string | undefined} The new name, if it changed.
     */
    _spanName(span: ReadableSpan, usePath: boolean, groups: WildcardMatcher[]): string | undefined;
}
/**
 * Parse a comma-separated list of span name group patterns. Parsing mimics
 * `getStringListFromEnv`, which is used for `ELASTIC_OTEL_SPAN_NAME_GROUPS`.
 *
 * @param {string | undefined} str
 * @returns {string[]}
 */
export function parseSpanNameGroups(str: string | undefined): string[];
