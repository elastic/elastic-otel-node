/**
 * This funtion makes necessari changes to the environment so:
 * - Avoid OTEL's NodeSDK known warnings (eg. OTEL_TRACES_EXPORTER not set)
 * - Fix some issues not solved yet in OTEL (https://github.com/open-telemetry/opentelemetry-js/issues/4447)
 * - Others ...
 */
export function setupEnvironment(): void;
/**
 * Restores any value stashed in the setup process
 */
export function restoreEnvironment(): void;
