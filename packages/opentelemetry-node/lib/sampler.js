/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {
    createCompositeSampler,
    createComposableParentThresholdSampler,
    createComposableTraceIDRatioBasedSampler,
} = require('@opentelemetry/sampler-composite');

/**
 * @typedef {import('@opentelemetry/api').Attributes} Attributes
 * @typedef {import('@opentelemetry/api').Context} Context
 * @typedef {import('@opentelemetry/api').Link} Link
 * @typedef {import('@opentelemetry/api').SpanKind} SpanKind
 * @typedef {import('@opentelemetry/sdk-trace-base').Sampler} Sampler
 * @typedef {import('@opentelemetry/sdk-trace-base').SamplingResult} SamplingResult
 */

/**
 * EDOT default sampler, a parent-based ratio sampler which can have its ratio updated dynamically.
 *
 * @implements {Sampler}
 */
class DefaultSampler {
    #delegate;

    constructor(ratio = 1.0) {
        this.#delegate = newSampler(ratio);
    }

    /**
     * @param {Context} context
     * @param {string} traceId
     * @param {string} spanName
     * @param {SpanKind} spanKind
     * @param {Attributes} attributes
     * @param {Link[]} links
     * @returns {SamplingResult}
     */
    shouldSample(context, traceId, spanName, spanKind, attributes, links) {
        return this.#delegate.shouldSample(
            context,
            traceId,
            spanName,
            spanKind,
            attributes,
            links
        );
    }

    /**
     * @param {number} ratio
     */
    setRatio(ratio) {
        this.#delegate = newSampler(ratio);
    }

    toString() {
        return this.#delegate.toString();
    }
}

/**
 * @param {number} ratio A number between 0 and 1 representing the sampling ratio.
 */
function newSampler(ratio) {
    return createCompositeSampler(
        createComposableParentThresholdSampler(
            createComposableTraceIDRatioBasedSampler(ratio)
        )
    );
}

/**
 * Creates a default EDOT sampler, which is a parent-based ratio sampler that can have
 * its ratio updated dynamically by central config.
 *
 * @param {number} ratio
 * @returns {Sampler} A ratio sampler which can have its ratio updated dynamically.
 */
function createDefaultSampler(ratio) {
    return new DefaultSampler(ratio);
}

module.exports = {
    createDefaultSampler,
};
