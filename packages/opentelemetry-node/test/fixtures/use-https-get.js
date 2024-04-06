// Usage: node -r @elastic/opentelemetry-node use-https-get.js
const https = require('https');
https.get('https://www.google.com/', (res) => {
    console.log('client response: %s %s', res.statusCode, res.headers);
    res.resume();
    res.on('end', () => {
        console.log('client response: end');
    });
});
