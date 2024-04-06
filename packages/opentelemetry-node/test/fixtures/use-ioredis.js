// Usage: node -r @elastic/opentelemetry-node use-ioredis.js

const otel = require('@opentelemetry/api');
const {Redis} = require('ioredis');

const redis = new Redis(process.env.REDIS_HOST, {
    maxRetriesPerRequest: 5, // fail fast in testing
});

async function main() {
    let val;

    redis.set('foo', 'bar');
    val = await redis.get('foo');
    console.log('GET foo:', val);

    redis.hset('myhash', 'field1', 'val1');
    try {
        val = await redis.get('myhash'); // Wrong command for type, should reject.
    } catch (e) {
        console.log('able to catch a GET error');
    }

    await redis.quit();
}

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-parent-span', (span) => {
    main();
    span.end();
});
