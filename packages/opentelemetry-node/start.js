const { ElasticNodeSDK } = require('./lib/sdk.js');

const sdk = new ElasticNodeSDK();

// TODO sdk shutdown: auto shutdown on beforeExit? SIGINT, better log on err
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(
      () => {},
      (err) => console.log("warning: error shutting down OTel SDK", err)
    )
    .finally(() => process.exit(0));
});

sdk.start();
