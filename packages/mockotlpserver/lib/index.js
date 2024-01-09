const {MockOtlpServer} = require('./mockotlpserver');
const {jsonStringifyTrace} = require('./printers');

/**
 * Normalize the given raw TraceServiceRequest.
 * - converts `traceId`, `spanId`, `parentSpanId` to hex
 * - converts `span.kind` and `span.status.code` to their enum string value
 * - converts longs to string
 *
 * TODO probably should live elsewhere
 *
 * See `jsonStringifyTrace()` in for full notes.
 */
function normalizeTrace(rawTrace) {
    const str = jsonStringifyTrace(rawTrace, {
        normAttributes: true,
    });
    return JSON.parse(str);
}

module.exports = {
    MockOtlpServer,
    normalizeTrace,
};
