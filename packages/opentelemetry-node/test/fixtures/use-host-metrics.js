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

// Usage: node -r ../../start.js use-host-metrics.js

const {createHash} = require('crypto');

// Do some work to get some CPU usage for more interesting HostMetrics values.
let lastProgressTime = Date.now();
const workInterval = setInterval(() => {
    const hash = createHash('sha256');
    hash.update(new Array(100).fill(Math.random()).join(','));
    if (Date.now() - lastProgressTime > 500) {
        console.log('.');
        lastProgressTime = Date.now();
    }
}, 10);

// Finish after 1.5x the metrics export interval, to be sure that some
// metrics have been reported for testing.
const exportInterval = process.env.ETEL_METRICS_INTERVAL_MS || 30000;
setTimeout(() => {
    console.log('finishing');
    clearInterval(workInterval);
}, exportInterval * 1.5);
