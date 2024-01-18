// Setup OTel telemetry using `@elastic/opentelemetry-node`, but via manual
// code-setup, rather than via the `-r @elastic/opentelemetry-node/start.js`
// convenience.

const {ElasticNodeSDK} = require('../');

const sdk = new ElasticNodeSDK();

process.once('beforeExit', async () => {
    try {
        await sdk.shutdown();
    } catch (err) {
        console.warn('warning: error shutting down OTel SDK', err);
    }
});

sdk.start();
