const { NodeSDK, tracing } = require('@opentelemetry/sdk-node');
const { envDetectorSync, hostDetectorSync, processDetectorSync } = require('@opentelemetry/resources');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');

class ElasticNodeSDK extends NodeSDK {
  constructor() {
    // TODO accept serviceName, detect service name
    super({
      serviceName: 'unknown-node-service',
      resourceDetectors: [
        envDetectorSync,
        processDetectorSync,
        // hostDetectorSync is not currently in the OTel default, but may be added
        hostDetectorSync
        // TODO cloud/container detectors by default
      ],
      // TODO real span exporter, debug exporter support (better than ConsoleSpanExporter)
      spanProcessor: new tracing.SimpleSpanProcessor(new tracing.ConsoleSpanExporter()),
      // TODO metrics
      // TODO log exporter? Optionally. Compare to apm-agent-java opts.
      // logRecordProcessor: new logs.SimpleLogRecordProcessor(new logs.ConsoleLogRecordExporter()),
      instrumentations: [
        // TODO All the instrumentations. Perf. Config support. Custom given instrs.
        new HttpInstrumentation(),
      ]
    });
  }
}

module.exports = {
  ElasticNodeSDK
};
