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
export function getEnvBoolean(name: string, defaultValue?: boolean): boolean;
export function getEnvNumber(name: string, defaultValue?: number): number;
export function getEnvString(name: string, defaultValue?: string): string;
export function getEnvStringList(name: string, defaultValue?: string[]): string[];
