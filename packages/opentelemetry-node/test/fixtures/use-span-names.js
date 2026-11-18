/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: node -r @elastic/opentelemetry-node use-span-names.js
//
// This creates spans shaped like those from HTTP server instrumentations, and
// other spans, to exercise span renaming.

const otel = require('@opentelemetry/api');

const tracer = otel.trace.getTracer('use-span-names');

function serverSpan(name, attributes) {
    tracer.startSpan(name, {kind: otel.SpanKind.SERVER, attributes}).end();
}

serverSpan('GET', {
    'http.request.method': 'GET',
    'url.path': '/users/42/cart',
});
serverSpan('GET', {
    'http.request.method': 'GET',
    'url.path': '/users/73/cart',
});
serverSpan('GET', {'http.request.method': 'GET', 'url.path': '/orders/1'});
serverSpan('GET', {'http.request.method': 'GET', 'url.path': '/Users/42'});
serverSpan('POST', {
    'http.request.method': 'POST',
    'url.path': '/users/42/cart',
});
// instr-http names the span with the method as received for unknown methods.
serverSpan('PURGE', {
    'http.request.method': '_OTHER',
    'http.request.method_original': 'PURGE',
    'url.path': '/purge',
});
// Semconv uses "HTTP" for unknown methods.
serverSpan('HTTP', {'http.request.method': '_OTHER', 'url.path': '/other'});
// A route is already in the name.
serverSpan('GET /users/:id', {
    'http.request.method': 'GET',
    'url.path': '/users/42',
});
// No path.
serverSpan('DELETE', {'http.request.method': 'DELETE'});

// Not server spans.
for (const kind of [otel.SpanKind.CLIENT, otel.SpanKind.INTERNAL]) {
    tracer
        .startSpan('PUT', {
            kind,
            attributes: {'http.request.method': 'PUT', 'url.path': '/put'},
        })
        .end();
}

// Other span names, for wildcard matching.
for (const name of [
    'process orders-123',
    'x-suffix',
    'aXbYc',
    'acb',
    'abbbb',
    'abbb',
    'lib.[a](b)+^$|\\?x',
    'libX[a](b)+^$|\\?x',
]) {
    tracer.startSpan(name).end();
}
