const {MockOtlpServer} = require('./mockotlpserver');
const {normalizeTrace, normalizeMetrics} = require('./normalize');

module.exports = {
    MockOtlpServer,
    normalizeTrace,
    normalizeMetrics,
};
