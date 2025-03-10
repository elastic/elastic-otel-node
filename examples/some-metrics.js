/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// An application that creates one of each kind of custom metric for
// demonstration purposes.

const otel = require('@opentelemetry/api');

const meter = otel.metrics.getMeter('some-metrics');

const counter = meter.createCounter('my_counter');

let n = 0;
const asyncCounter = meter.createObservableCounter('my_async_counter');
asyncCounter.addCallback((observableResult) => {
    observableResult.observe(n);
});

const asyncGauge = meter.createObservableGauge('my_async_gauge');
asyncGauge.addCallback((observableResult) => {
    // A sine wave with a 5 minute period, to have a recognizable pattern.
    observableResult.observe(
        Math.sin((Date.now() / 1000 / 60 / 5) * (2 * Math.PI))
    );
});

const upDownCounter = meter.createUpDownCounter('my_updowncounter');

let c = 0;
const asyncUpDownCounter = meter.createObservableUpDownCounter(
    'my_async_updowncounter'
);
asyncUpDownCounter.addCallback((observableResult) => {
    observableResult.observe(c);
});

const histogram = meter.createHistogram('my_histogram');

setInterval(() => {
    n++;
    counter.add(1);
    if (new Date().getUTCSeconds() < 30) {
        c++;
        upDownCounter.add(1);
    } else {
        c--;
        upDownCounter.add(-1);
    }
    histogram.record(2);
    histogram.record(3);
    histogram.record(4);
}, 200);
