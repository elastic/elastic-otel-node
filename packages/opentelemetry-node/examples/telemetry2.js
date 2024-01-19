// Setup OTel telemetry using `@elastic/opentelemetry-node`, using an
// experimental alternative API where one uses the OTel NodeSDK directly and
// uses Elastic's distro just for configuration helpers.

const {getNodeSDKConfig} = require('../');
const {NodeSDK} = require('@opentelemetry/sdk-node');

// XXX I'm not sure where/what API would be appropriate to set diag to a luggite logger, if at all.

const config = getNodeSDKConfig({
    serviceName: process.env.TEL_SERVICE_NAME ?? undefined,
});
// XXX If this uses the *user's* selected NodeSDK version and the config schema changes
//     then how can we know what form to use for `config`. This favours having our own
//     internal subclass... or we need to be very strict about peerDep range. ??
const sdk = new NodeSDK(config);

process.once('beforeExit', async () => {
    try {
        await sdk.shutdown();
    } catch (err) {
        console.warn('warning: error shutting down OTel SDK', err);
    }
});

sdk.start();
