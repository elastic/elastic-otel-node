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

// Usage: node -r ../../start.js use-bunyan.js

const bunyan = require('bunyan');
const otel = require('@opentelemetry/api');

const log = bunyan.createLogger({name: 'use-bunyan'});

log.info({foo: 'bar'}, 'hi');

const tracer = otel.trace.getTracer('test');
tracer.startActiveSpan('manual-span', (span) => {
    log.info('with span info');
    span.end();
});
