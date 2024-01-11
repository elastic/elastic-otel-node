const otel = require('@opentelemetry/api');
const {HostMetrics} = require('@elastic/opentelemetry-node-host-metrics');
const {ElasticNodeSDK} = require('./lib/sdk.js');

const sdk = new ElasticNodeSDK();
const hostMetrics = new HostMetrics({
    meterProvider: otel.metrics.getMeterProvider(),
    name: 'example-host-metrics',
});
hostMetrics.start();

// TODO sdk shutdown: also SIGINT?
// TODO sdk shutdown handlers: better log on err
// TODO sdk shutdown: make these handlers configurable?
//  - If so, could move these into sdk.js and it could use its logger for logging an error.
//  - Note, only want luggite.warn over console.warn if errSerializer gets
//    all attributes (console.warn shows more data for ECONNREFUSED)
// TODO sdk shutdown beforeExit: skip this for Lambda (also Azure Fns?)
// TODO sdh shutdown: call process.exit?
// Note: Per https://github.com/open-telemetry/opentelemetry-js/issues/1521
// core OTel explicitly decided *not* to call `process.exit()`. Personally
// I think that means it should not install a SIGTERM handler, assuming my
// understanding is correct that a SIGTERM handler without process.exit()
// will prevent the program exiting if it otherwise would.

process.on('SIGTERM', async () => {
    try {
        await sdk.shutdown();
    } catch (err) {
        console.warn('warning: error shutting down OTel SDK', err);
    }
    process.exit();
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
