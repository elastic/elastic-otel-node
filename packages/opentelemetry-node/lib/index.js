const {getNodeSDKConfig} = require('./config');
const {ElasticNodeSDK} = require('./sdk');

// TODO: if we go the "provide SDK subclass" route, then this should reexport
//       things for @otel/sdk-node (like 'api', 'core', etc.)

module.exports = {
    getNodeSDKConfig,
    ElasticNodeSDK,
};
