/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
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
