const {diag} = require('@opentelemetry/api');

diag.verbose('hi at verbose');
diag.debug('hi at debug');
diag.info('hi at info');
diag.warn('hi at warn');
diag.error('hi at error');

console.log('OTEL_LOG_LEVEL:', process.env.OTEL_LOG_LEVEL);
