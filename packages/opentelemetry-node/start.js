const os = require('os');
const {ElasticNodeSDK} = require('./lib/sdk.js');

const sdk = new ElasticNodeSDK();

// TODO sdk shutdown: also SIGINT?
// TODO sdk shutdown handlers: better log on err
// TODO sdk shutdown: make these handlers configurable?
//  - If so, could move these into sdk.js and it could use its logger for logging an error.
//  - Note, only want luggite.warn over console.warn if errSerializer gets
//    all attributes (console.warn shows more data for ECONNREFUSED)
// TODO sdk shutdown beforeExit: skip this for Lambda (also Azure Fns?)
// TODO sdh shutdown: call process.exit?
// TODO: Whether we have a signal handler for sdk.shutdown() is debatable. It
// definitely *can* change program behaviour. Let's reconsider.
// Note: See https://github.com/open-telemetry/opentelemetry-js/issues/1521
// for some thoughts on automatic handling to shutdown the SDK.

process.on('SIGTERM', async () => {
    try {
        await sdk.shutdown();
    } catch (err) {
        console.warn('warning: error shutting down OTel SDK', err);
    }
    process.exit(128 + os.constants.signals.SIGTERM);
});

process.once('beforeExit', async () => {
    // Flush recent telemetry data if about the shutdown.
    try {
        await sdk.shutdown();
    } catch (err) {
        console.warn('warning: error shutting down OTel SDK', err);
    }
});

sdk.start();
