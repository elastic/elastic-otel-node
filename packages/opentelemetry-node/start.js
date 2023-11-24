const { ElasticNodeSDK } = require('./lib/sdk.js');

// TODO setup diag? What sys for logging? our own thing? pino?
// api.diag.setLogger(new api.DiagConsoleLogger(), api.DiagLogLevel.DEBUG);

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
