const {MockOtlpServer} = require('./mockotlpserver');
const {
    normalizeLogs,
    normalizeTrace,
    normalizeMetrics,
} = require('./normalize');

module.exports = {
    MockOtlpServer,
    normalizeLogs,
    normalizeTrace,
    normalizeMetrics,
};
