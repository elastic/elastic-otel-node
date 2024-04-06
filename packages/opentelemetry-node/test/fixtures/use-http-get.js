// Usage: node -r @elastic/opentelemetry-node use-http-get.js
const http = require('http');
http.get('http://www.google.com/', (res) => {
    console.log('client response: %s %s', res.statusCode, res.headers);
    res.resume();
    res.on('end', () => {
        console.log('client response: end');
    });
});
