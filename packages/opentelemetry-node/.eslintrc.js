const config = require('../../.eslintrc.js');
config.rules["license-header/header"] = ["error", "../../scripts/license-header.js"];

module.exports = config;
