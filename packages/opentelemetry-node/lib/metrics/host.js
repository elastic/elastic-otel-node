/**
 * NOTICE: all this code below has the only purpose of provide a new `View`
 * that does a simple aggregation (trim in this case) for `system.cpu.utilization`
 * metric.
 * This is too much code for a simple trim of data:
 * - `@opentelemetry/sdk-metrics` should offer a easier way to do it and also
 *   should export all the necessary building blocks like `LastValueAccumulation`
 *   class and `AggregatorKind` enum
 * - we might look for an alternate solution in this case (no proposal for now)
 *
 * Most of this code will be removed when https://github.com/open-telemetry/opentelemetry-js/issues/4616
 * is solved.
 */
/**
 * @typedef {import('@opentelemetry/api').HrTime} HrTime
 */
/**
 * @template T
 * @typedef {import('@opentelemetry/sdk-metrics/build/src/aggregator/types').Aggregator<T>} Aggregator<T>
 */
/**
 * @template T
 * @typedef {import('@opentelemetry/sdk-metrics/build/src/aggregator/types').AccumulationRecord<T>} AccumulationRecord<T>
 */
/**
 * @typedef {import('@opentelemetry/sdk-metrics').LastValueAggregation} LastValueAggregation
 * @typedef {import('@opentelemetry/sdk-metrics/build/src/aggregator/types').Accumulation} Accumulation
 * @typedef {import('@opentelemetry/sdk-metrics').MetricDescriptor} MetricDescriptor
 * @typedef {import('@opentelemetry/sdk-metrics').AggregationTemporality} AggregationTemporality
 * @typedef {import('@opentelemetry/sdk-metrics').GaugeMetricData} GaugeMetricData
 */

const {core, metrics} = require('@opentelemetry/sdk-node');
const {millisToHrTime, hrTimeToMicroseconds} = core;
const {Aggregation, DataPointType, View} = metrics;
const {HostMetrics} = require('@opentelemetry/host-metrics');

/**
 * TODO: Copied from `@opentelemetry/sdk-metrics` since it's not exported
 * https://github.com/open-telemetry/opentelemetry-js/blob/f86251d40fbf615be87319c8a1f5643afb820076/packages/sdk-metrics/src/aggregator/LastValue.ts#L34
 *
 * Remove when https://github.com/open-telemetry/opentelemetry-js/issues/4616 is fixed
 *
 * @todo remove this class when sdk.metrics exports it
 * @class
 * @implements {Accumulation}
 */
class LastValueAccumulation {
    /**
     *
     * @param {HrTime} startTime
     * @param {number} [current]
     * @param {HrTime} [sampleTime]
     */
    constructor(startTime, current, sampleTime) {
        this.startTime = startTime;
        this._current = current || 0;
        this.sampleTime = sampleTime || millisToHrTime(Date.now());
    }

    /**
     * @param {number} value
     */
    record(value) {
        this._current = value;
        this.sampleTime = millisToHrTime(Date.now());
    }

    /**
     * @param {HrTime} startTime
     */
    setStartTime(startTime) {
        this.startTime = startTime;
    }

    /**
     * @returns {number}
     */
    toPointValue() {
        return this._current;
    }
}

/**
 * @class
 * @implements {Aggregator<LastValueAccumulation>}
 */
class SystemCpuUtilizationAggregator {
    // TODO: Hardcoded the value of `AggregatorKind` enum for GAUGE. Remove
    // when issue below is fixed
    // Issue: https://github.com/open-telemetry/opentelemetry-js/issues/4616
    // https://github.com/open-telemetry/opentelemetry-js/blob/f86251d40fbf615be87319c8a1f5643afb820076/packages/sdk-metrics/src/aggregator/types.ts#L23
    kind = 2;

    /**
     *
     * @param {HrTime} startTime
     * @returns
     */
    createAccumulation(startTime) {
        return new LastValueAccumulation(startTime);
    }

    /**
     * Return the newly captured (delta) accumulation for SystemCpuUtilizationAggregator.
     *
     * @param {LastValueAccumulation} previous
     * @param {LastValueAccumulation} delta
     * @returns {LastValueAccumulation}
     */
    merge(previous, delta) {
        // nanoseconds may lose precisions.
        const latestAccumulation =
            hrTimeToMicroseconds(delta.sampleTime) >=
            hrTimeToMicroseconds(previous.sampleTime)
                ? delta
                : previous;
        return new LastValueAccumulation(
            previous.startTime,
            latestAccumulation.toPointValue(),
            latestAccumulation.sampleTime
        );
    }

    /**
     * A delta aggregation is not meaningful to SystemCpuUtilizationAggregator, just return
     * the newly captured (delta) accumulation for SystemCpuUtilizationAggregator.
     *
     * @param {LastValueAccumulation} previous
     * @param {LastValueAccumulation} current
     * @returns {LastValueAccumulation}
     */
    diff(previous, current) {
        // nanoseconds may lose precisions.
        const latestAccumulation =
            hrTimeToMicroseconds(current.sampleTime) >=
            hrTimeToMicroseconds(previous.sampleTime)
                ? current
                : previous;
        return new LastValueAccumulation(
            current.startTime,
            latestAccumulation.toPointValue(),
            latestAccumulation.sampleTime
        );
    }

    /**
     * Groups data points by `system.cpu.logical_number` so we have the total
     * utilization per CPU.
     *
     * We cannot sum up the utilization of all the states since `os.cpus()` is
     * not returning all of the possible states but limited to: user, nice, sys, idle, irq
     * https://nodejs.org/api/all.html#all_os_oscpus
     *
     * where in linux we have more: user, nice, system, idle, iowait, irq, softirq, steal, guest, guest_nice
     * https://man7.org/linux/man-pages/man5/proc.5.html
     *
     * So in order to have the most accurate metric of utilization we use
     * the formula 1 - (idle utilization)
     *
     * As an example given the data points:
     * - { value: 0.1, attributes: { 'system.cpu.logical_number': 0, 'system.cpu.state': 'idle' } }
     * - { value: 0.5, attributes: { 'system.cpu.logical_number': 0, 'system.cpu.state': 'system' } }
     * - { value: 0.2, attributes: { 'system.cpu.logical_number': 0, 'system.cpu.state': 'user' } }
     * - { value: 0.1, attributes: { 'system.cpu.logical_number': 0, 'system.cpu.state': 'nice' } }
     * - { value: 0.1, attributes: { 'system.cpu.logical_number': 0, 'system.cpu.state': 'interrupt' } }
     * - { value: 0.2, attributes: { 'system.cpu.logical_number': 1, 'system.cpu.state': 'idle' } }
     * - { value: 0.4, attributes: { 'system.cpu.logical_number': 1, 'system.cpu.state': 'system' } }
     * - { value: 0.1, attributes: { 'system.cpu.logical_number': 1, 'system.cpu.state': 'user' } }
     * - { value: 0.1, attributes: { 'system.cpu.logical_number': 1, 'system.cpu.state': 'nice' } }
     * - { value: 0.2, attributes: { 'system.cpu.logical_number': 1, 'system.cpu.state': 'interrupt' } }
     *
     * the aggregator will send
     * - { value: 0.9, attributes: { 'system.cpu.logical_number': 0 } }
     * - { value: 0.8, attributes: { 'system.cpu.logical_number': 1 } }
     *
     * @param {MetricDescriptor} descriptor
     * @param {AggregationTemporality} aggregationTemporality
     * @param {AccumulationRecord<LastValueAccumulation>[]} accumulationByAttributes
     * @param {HrTime} endTime
     * @returns {GaugeMetricData | undefined}
     */
    toMetricData(
        descriptor,
        aggregationTemporality,
        accumulationByAttributes,
        endTime
    ) {
        return {
            descriptor,
            aggregationTemporality,
            dataPointType: DataPointType.GAUGE,
            dataPoints: accumulationByAttributes
                .filter(([attribs]) => attribs['system.cpu.state'] === 'idle')
                .map(([attributes, accumulation]) => {
                    delete attributes['system.cpu.state'];
                    return {
                        attributes,
                        startTime: accumulation.startTime,
                        endTime,
                        value: 1 - accumulation.toPointValue(),
                    };
                }),
        };
    }
}

class SystemCpuUtilizationAggregation extends Aggregation {
    createAggregator(instrument) {
        return new SystemCpuUtilizationAggregator();
    }
}

/** @type {HostMetrics} */
let hostMetricsInstance;
function enableHostMetrics() {
    // NOTE: we set the scope name to the package name `@opentelemetry/host-metrics` like
    // other instrumentations do. This way we can differentiate if the user collects the
    // host metrics with a different utility or package
    hostMetricsInstance = new HostMetrics({
        name: '@opentelemetry/host-metrics',
    });
    hostMetricsInstance.start();
}

// It is known that host metrics sends a lot of data so for now we drop some
// instruments that are not handled by Kibana and doing aggregations
// for others that we want to include shorly (CPU metrics)
// Ref (data amount issue): https://github.com/elastic/elastic-otel-node/issues/51
// Ref (metrics in Kibana): https://github.com/elastic/kibana/pull/174700
// TODO: if metrics filter config becomes a thing we may want to convert this to a
// function that receives the filter as a param (or gets it from env)
/** @type {metrics.View[]} */
const HOST_METRICS_VIEWS = [
    // drop `system.network.*` (not in Kibana)
    new View({
        instrumentName: 'system.network.*',
        aggregation: Aggregation.Drop(),
    }),
    // drop `system.cpu.time` (not in Kibana)
    new View({
        instrumentName: 'system.cpu.time',
        aggregation: Aggregation.Drop(),
    }),
    // drop `process.*` (not in Kibana)
    new View({
        instrumentName: 'process.*',
        aggregation: Aggregation.Drop(),
    }),
    // Do an aggregation to avoid cardinality problems because of the possible
    // permutations of state & logical_number attributes
    new View({
        instrumentName: 'system.cpu.utilization',
        aggregation: new SystemCpuUtilizationAggregation(),
    }),
];

module.exports = {
    HOST_METRICS_VIEWS,
    enableHostMetrics,
};
