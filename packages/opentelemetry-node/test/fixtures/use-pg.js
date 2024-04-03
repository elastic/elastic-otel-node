// Usage: node -r ../../start.js use-pg.js

const otel = require('@opentelemetry/api');
const {Client} = require('pg');

async function main() {
    const client = new Client({
        user: process.env.PGUSER || 'postgres',
    });
    await client.connect();

    const res = await client.query('SELECT $1::text as message', ['hi']);
    console.log('SELECT result:', res.rows[0].message);

    await client.end();
}

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-parent-span', (span) => {
    main();
    span.end();
});
