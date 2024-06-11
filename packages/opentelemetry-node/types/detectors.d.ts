/**
 * NOTE: when `Detector` is finally removed import only `DetectorSync` and
 * get rid of the aliasing
 */
export type DetectorOrig = import('@opentelemetry/resources').Detector;
/**
 * NOTE: when `Detector` is finally removed import only `DetectorSync` and
 * get rid of the aliasing
 */
export type DetectorSyncOrig = import('@opentelemetry/resources').DetectorSync;
/**
 * NOTE: when `Detector` is finally removed import only `DetectorSync` and
 * get rid of the aliasing
 */
export type DetectorSync = DetectorOrig | DetectorSyncOrig;
/**
 * @param {Array<DetectorSync>} [detectors]
 * @returns {Array<DetectorSync>}
 */
export function resolveDetectors(detectors?: Array<DetectorSync>): Array<DetectorSync>;
