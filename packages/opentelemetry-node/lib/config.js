const {
    envDetectorSync,
    hostDetectorSync,
    processDetectorSync,
} = require('@opentelemetry/resources');
const {HttpInstrumentation} = require('@opentelemetry/instrumentation-http');

function getNodeSDKConfig(opts) {
    const defaultConfig = {
        resourceDetectors: [
            envDetectorSync,
            processDetectorSync,
            // hostDetectorSync is not currently in the OTel default, but may be added
            hostDetectorSync,
            // TODO cloud/container detectors by default
        ],
        // TODO metrics
        // TODO log exporter? Optionally. Compare to apm-agent-java opts.
        // logRecordProcessor: new logs.SimpleLogRecordProcessor(new logs.ConsoleLogRecordExporter()),
        instrumentations: [
            // TODO All the instrumentations. Perf. Config support. Custom given instrs.
            new HttpInstrumentation(),
        ],
    };
    const config = Object.assign(defaultConfig, opts);
    return config;
}
module.exports = {
    getNodeSDKConfig,
};
