const {ElasticNodeSDK} = require('./sdk');
const {getInstrumentations} = require('./instrumentations');

// TODO: this should reexport things from @otel/sdk-node (like 'api', 'core', etc.)

module.exports = {
    ElasticNodeSDK,
    getInstrumentations,
};
