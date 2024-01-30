const {Resource} = require('@opentelemetry/resources');

const ELASTIC_SDK_VERSION = require('../package.json').version;

class ElasticDistroDetector {
    detect() {
        // TODO: change to semconv resource attribs when
        // `@opentelemetry/semantic-conventions`get updated with the attribs used
        // https://github.com/open-telemetry/opentelemetry-js/issues/4235
        return new Resource({
            'telemetry.distro.name': 'elastic',
            'telemetry.distro.version': ELASTIC_SDK_VERSION,
        });
    }
}

module.exports = {
    distroDetectorSync: new ElasticDistroDetector(),
};
