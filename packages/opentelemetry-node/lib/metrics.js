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
const {DataPointType} = require('@opentelemetry/sdk-metrics');

/**
 * @class
 * @implements {Accumulation}
 */
class CpuNumberValueAccumulation {
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
        console.log('record', value);
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
 * @implements {Aggregator<CpuNumberValueAccumulation>}
 */
class CpuUtilizationAggregation {
    kind = 2;

    /**
     *
     * @param {HrTime} startTime
     * @returns
     */
    createAccumulation(startTime) {
        return new CpuNumberValueAccumulation(startTime);
    }

    /**
     * Return the newly captured (delta) accumulation for CpuUtilizationAggregation.
     *
     * @param {CpuNumberValueAccumulation} previous
     * @param {CpuNumberValueAccumulation} delta
     * @returns {CpuNumberValueAccumulation}
     */
    merge(previous, delta) {
        // nanoseconds may lose precisions.
        const latestAccumulation =
            hrTimeToMicroseconds(delta.sampleTime) >=
            hrTimeToMicroseconds(previous.sampleTime)
                ? delta
                : previous;
        return new CpuNumberValueAccumulation(
            previous.startTime,
            latestAccumulation.toPointValue(),
            latestAccumulation.sampleTime
        );
    }

    /**
     * A delta aggregation is not meaningful to CpuUtilizationAggregation, just return
     * the newly captured (delta) accumulation for CpuUtilizationAggregation.
     *
     * @param {CpuNumberValueAccumulation} previous
     * @param {CpuNumberValueAccumulation} current
     * @returns {CpuNumberValueAccumulation}
     */
    diff(previous, current) {
        // nanoseconds may lose precisions.
        const latestAccumulation =
            hrTimeToMicroseconds(current.sampleTime) >=
            hrTimeToMicroseconds(previous.sampleTime)
                ? current
                : previous;
        return new CpuNumberValueAccumulation(
            current.startTime,
            latestAccumulation.toPointValue(),
            latestAccumulation.sampleTime
        );
    }

    /**
     *
     * @param {MetricDescriptor} descriptor
     * @param {AggregationTemporality} aggregationTemporality
     * @param {AccumulationRecord<CpuNumberValueAccumulation>[]} accumulationByAttributes
     * @param {HrTime} endTime
     * @returns {GaugeMetricData | undefined}
     */
    toMetricData(
        descriptor,
        aggregationTemporality,
        accumulationByAttributes,
        endTime
    ) {
        console.log(
            'toMetricData',
            descriptor,
            aggregationTemporality,
            endTime
        );
        // Accumulate bhy cpu state and calculate the average
        /** @type {Map<string, number[]>} */
        const stateValues = new Map();
        accumulationByAttributes.forEach(([attributes, accumulation]) => {
            const key = `${attributes['system.cpu.state']}`;
            const val = accumulation.toPointValue();
            if (stateValues.has(key)) {
                stateValues.get(key).push(val);
            } else {
                stateValues.set(key, [val]);
            }
        });

        const startTime = accumulationByAttributes[0][1].startTime;

        return {
            descriptor,
            aggregationTemporality,
            dataPointType: DataPointType.GAUGE,
            dataPoints: Array.from(stateValues.entries()).map(
                ([state, values]) => {
                    return {
                        attributes: {
                            'system.cpu.state': state,
                            'system.cpu.logical_number': 0,
                        },
                        startTime,
                        endTime,
                        value:
                            values.reduce((sum, val) => sum + val, 0) /
                            values.length,
                    };
                }
            ),
        };

        // return {
        //     descriptor,
        //     aggregationTemporality,
        //     dataPointType: DataPointType.GAUGE,
        //     dataPoints: accumulationByAttributes.map(
        //         ([attributes, accumulation]) => {
        //             return {
        //                 attributes,
        //                 startTime: accumulation.startTime,
        //                 endTime,
        //                 value: accumulation.toPointValue(),
        //             };
        //         }
        //     ),
        // };
    }
}

module.exports = {
    CpuUtilizationAggregation,
};
