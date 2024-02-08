/**
 * Type imports
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

const {millisToHrTime, hrTimeToMicroseconds} = require('@opentelemetry/core');
const {
    Aggregation,
    DataPointType,
    View,
} = require('@opentelemetry/sdk-metrics');
const {HostMetrics} = require('@opentelemetry/host-metrics');

/**
 * Copied from `@opentelemetry/sdk-metrics` since it's not exported
 * https://github.com/open-telemetry/opentelemetry-js/blob/f86251d40fbf615be87319c8a1f5643afb820076/packages/sdk-metrics/src/aggregator/LastValue.ts#L34
 *
 * @todo remoce this class and require it when exported
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
    // TODO: hardcoded the value of `AggregatorKind` enum for GAUGE
    // remove when exported
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
     * Does the sum of data points grouping by `system.cpu.logical_number` so we have the total
     * utilization per CPU. Basically the value would be 1 - idle_value
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
        console.log('toMetricdata');
        console.dir(accumulationByAttributes, {depth: 5});

        // XXX: the calculation of utilization with the formula 1 - idle_value seems incorrect
        // given the data
        // [
        //     { 'system.cpu.state': 'user', 'system.cpu.logical_number': '0' },
        //     {
        //       startTime: [ 1707301875, 111000000 ],
        //       _current: 0.20908004778972522,
        //       sampleTime: [ 1707301875, 201000000 ]
        //     },
        //     '[["system.cpu.logical_number","0"],["system.cpu.state","user"]]'
        //   ],
        //   [
        //     { 'system.cpu.state': 'system', 'system.cpu.logical_number': '0' },
        //     {
        //       startTime: [ 1707301875, 111000000 ],
        //       _current: 0.13341298287534847,
        //       sampleTime: [ 1707301875, 201000000 ]
        //     },
        //     '[["system.cpu.logical_number","0"],["system.cpu.state","system"]]'
        //   ],
        //   [
        //     { 'system.cpu.state': 'idle', 'system.cpu.logical_number': '0' },
        //     {
        //       startTime: [ 1707301875, 111000000 ],
        //       _current: 0.599362803663879,
        //       sampleTime: [ 1707301875, 201000000 ]
        //     },
        //     '[["system.cpu.logical_number","0"],["system.cpu.state","idle"]]'
        //   ],
        //   [
        //     {
        //       'system.cpu.state': 'interrupt',
        //       'system.cpu.logical_number': '0'
        //     },
        //     {
        //       startTime: [ 1707301875, 111000000 ],
        //       _current: 0,
        //       sampleTime: [ 1707301875, 201000000 ]
        //     },
        //     '[["system.cpu.logical_number","0"],["system.cpu.state","interrupt"]]'
        //   ],
        //   [
        //     { 'system.cpu.state': 'nice', 'system.cpu.logical_number': '0' },
        //     {
        //       startTime: [ 1707301875, 111000000 ],
        //       _current: 0,
        //       sampleTime: [ 1707301875, 201000000 ]
        //     },
        //     '[["system.cpu.logical_number","0"],["system.cpu.state","nice"]]'
        //   ],
        //   ... other values for other CPUs
        // ]
        //
        // we can check that 1 - 0.599362803663879 !== 0.20908004778972522 + 0.13341298287534847
        // my guess is that the instrumentation does not give all the data/states of the CPU
        // should we assume that diff is CPU being used but not reported? hence take `idle` value
        // as the source to calculate utilization?

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
    // TODO: make this configurable, user might collect host metrics with a separate utility
    hostMetricsInstance = new HostMetrics({
        name: '',
    });
    hostMetricsInstance.start();
}

/** @type {View[]} */
const HOST_METRICS_VIEWS = [
    // drop network metrics for now
    new View({
        instrumentName: 'system.network.*',
        aggregation: Aggregation.Drop(),
    }),
    // `system.cpu.time` also has lots of values since it reports values per each state and CPU.
    new View({
        instrumentName: 'system.cpu.time',
        aggregation: Aggregation.Drop(),
    }),
    new View({
        instrumentName: 'system.cpu.utilization',
        aggregation: new SystemCpuUtilizationAggregation(),
    }),
];

module.exports = {
    HOST_METRICS_VIEWS,
    enableHostMetrics,
};
