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

/**
 * @typedef {import('@opentelemetry/instrumentation').Instrumentation} Instrumentation
 *
 * @callback InstrumentationFactory
 * @returns {Instrumentation}
 *
 * @typedef {{
 *  "@opentelemetry/instrumentation-bunyan": import('@opentelemetry/instrumentation-bunyan').BunyanInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-http": import('@opentelemetry/instrumentation-http').HttpInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-ioredis": import('@opentelemetry/instrumentation-ioredis').IORedisInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-express": import('@opentelemetry/instrumentation-express').ExpressInstrumentationConfig | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-fastify": import('@opentelemetry/instrumentation-fastify').FastifyInstrumentation | InstrumentationFactory,
 *  "@opentelemetry/instrumentation-mongodb": import('@opentelemetry/instrumentation-mongodb').MongoDBInstrumentation | InstrumentationFactory
 *  "@opentelemetry/instrumentation-pg": import('@opentelemetry/instrumentation-pg').PgInstrumentation | InstrumentationFactory
 *  "@opentelemetry/instrumentation-winston": import('@opentelemetry/instrumentation-winston').WinstonInstrumentationConfig | InstrumentationFactory,
 * "@opentelemetry/instrumentation-tedious": import('@opentelemetry/instrumentation-tedious').TediousInstrumentation | InstrumentationFactory,
 * }} InstrumentaionsMap
 */

const {
    BunyanInstrumentation,
} = require('@opentelemetry/instrumentation-bunyan');
const {HttpInstrumentation} = require('@opentelemetry/instrumentation-http');
const {
    IORedisInstrumentation,
} = require('@opentelemetry/instrumentation-ioredis');
const {
    ExpressInstrumentation,
} = require('@opentelemetry/instrumentation-express');
const {
    FastifyInstrumentation,
} = require('@opentelemetry/instrumentation-fastify');
const {
    MongoDBInstrumentation,
} = require('@opentelemetry/instrumentation-mongodb');
const {PgInstrumentation} = require('@opentelemetry/instrumentation-pg');
const {
    WinstonInstrumentation,
} = require('@opentelemetry/instrumentation-winston');
const {
    TediousInstrumentation,
} = require('@opentelemetry/instrumentation-tedious');

// Instrumentations attach their Hook (for require-in-the-middle or import-in-the-middle)
// when the `enable` method is called and this happens inside their constructor
// https://github.com/open-telemetry/opentelemetry-js/blob/1b4999f386e0240b7f65350e8360ccc2930b0fe6/experimental/packages/opentelemetry-instrumentation/src/platform/node/instrumentation.ts#L71
//
// The SDK cannot construct any instrumentation until it has resolved the config. So to
// do a lazy creation of instrumentations we have factory functions that can receive
// the user's config and can default to something else if needed.
/** @type {Record<keyof InstrumentaionsMap, (cfg: any) => Instrumentation>} */
const INSTRUMENTATIONS = {
    '@opentelemetry/instrumentation-bunyan': (cfg) =>
        new BunyanInstrumentation(cfg),
    '@opentelemetry/instrumentation-express': (cfg) =>
        new ExpressInstrumentation(cfg),
    '@opentelemetry/instrumentation-fastify': (cfg) =>
        new FastifyInstrumentation(cfg),
    '@opentelemetry/instrumentation-http': (cfg) =>
        new HttpInstrumentation(cfg),
    '@opentelemetry/instrumentation-ioredis': (cfg) =>
        new IORedisInstrumentation(cfg),
    '@opentelemetry/instrumentation-mongodb': (cfg) =>
        new MongoDBInstrumentation(cfg),
    '@opentelemetry/instrumentation-pg': (cfg) => new PgInstrumentation(cfg),
    '@opentelemetry/instrumentation-winston': (cfg) =>
        new WinstonInstrumentation(cfg),
    '@opentelemetry/instrumentation-tedious': (cfg) =>
        new TediousInstrumentation(cfg),
};

/**
 * With this method you can disable, configure and replace the instrumentations
 * supported by ElastiNodeSDK. The result is an array of all the
 * active instrumentations based on the options parameter which is an object
 * of `instrumentation_name` as keys and objects or functions as values.
 * - if instrumentation name is not present in keys default instrumentation is
 *   returned
 * - if instrumentation name is present in keys and has an object as value this
 *   will be used as configuration. Note you can disable with `{ enable: false }`
 * - if instrumentation name is present in keys and has an function as value this
 *   will be used as a factory and the object retuned by th function will replace
 *   the instrumentation
 *
 * You can use this function if are developing your own telemetry script as an aid
 * to configure your instrumentations array
 *
 * Example:
 *
 * ```js
 * const customInstrumentations = getInstrumentations({
 *      // HTTP instrumentation will get a specific config
 *     '@opentelemetry/instrumentation-http': {
 *          serverName: 'foo'
 *      },
 *      // Express insrumentation will be disabled and not returned
 *      '@opentelemetry/instrumentation-express': {
 *          enabled: false,
 *      },
 *      // You can replace a instrumentation by using a funciton
 *      '@opentelemetry/instrumentation-mongodb': () => {
 *          return new MyMongoDBInstrumentation();
 *      }
 * });
 *
 * const sdk = new ElasticNodeSDK({
 *      instrumentations: [
 *          ...customInstrumentations,
 *          // You can add here instrumentations from other sources
 *      ]
 * });
 * ```
 *
 * @param {Partial<InstrumentaionsMap>} [opts={}]
 * @returns {Array<Instrumentation>}
 */
function getInstrumentations(opts = {}) {
    /** @type {Array<Instrumentation>} */
    const instrumentations = [];

    Object.keys(INSTRUMENTATIONS).forEach((name) => {
        const isFactory = typeof opts[name] === 'function';
        const isObject = typeof opts[name] === 'object';
        const instrFactory = isFactory ? opts[name] : INSTRUMENTATIONS[name];
        const instrConfig = isObject ? opts[name] : undefined;

        // We should instantiate a instrumentation if:
        // - there is no config passed (elastic SDK will use its defaults)
        // - the configuration passed is not disabling it
        let instr;
        if (!instrConfig || instrConfig.enabled !== false) {
            instr = instrFactory(instrConfig);
        }

        if (instr) {
            instrumentations.push(instr);
        }
    });

    return instrumentations;
}

module.exports = {
    getInstrumentations,
};
