export type ResourceDetector = import('@opentelemetry/resources').ResourceDetector;
/**
 * @param {Array<ResourceDetector>} [detectors]
 * @returns {Array<ResourceDetector>}
 */
export function resolveDetectors(detectors?: Array<ResourceDetector>): Array<ResourceDetector>;
