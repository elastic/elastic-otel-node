// Setup OTel telemetry using `@elastic/opentelemetry-node`, but via manual
// code-setup, rather than via the `-r @elastic/opentelemetry-node/start.js`
// convenience.

const {ElasticNodeSDK} = require('../');

const sdk = new ElasticNodeSDK({
    // Show an example of custom code for configuring the SDK possible when
    // using a separate "telemetry.js" file for bootstrapping.
    serviceName: process.env.MY_SERVICE_NAME ?? undefined,
});

process.once('beforeExit', async () => {
    try {
        await sdk.shutdown();
    } catch (err) {
        console.warn('warning: error shutting down OTel SDK', err);
    }
});

sdk.start();
