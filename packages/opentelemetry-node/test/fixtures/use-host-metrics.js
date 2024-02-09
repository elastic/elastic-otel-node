const {createHash} = require('crypto');

const exportInterval = process.env.ETEL_METRICS_INTERVAL_MS;
const exportTime = Date.now() + exportInterval * 1.5;

// Do some operations to get some CPU usage
const timerId = setInterval(() => {
    if (exportTime < Date.now()) {
        clearInterval(timerId);
        return;
    }

    const hash = createHash('sha256');
    hash.update(new Array(100).fill(Math.random()).join(','));
    console.log(hash.digest('hex'));
}, 10);
