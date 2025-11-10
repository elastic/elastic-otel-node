/**
 * Tweak `process.env` before calling NodeSDK.
 */
export function setupEnvironment(): void;
/**
 * Restores any `process.env` stashed in `setupEnvironment()`.
 */
export function restoreEnvironment(): void;
/**
 * Return an object with all `OTEL_` and `ELASTIC_OTEL_` envvars that are **safe
 * to be logged**. I.e. this redacts the value of any envvar not on the
 * allowlist of non-sensitive envvars.
 *
 * Compare to the equiv in EDOT Python:
 * https://github.com/elastic/elastic-otel-python/blob/v1.9.0/src/elasticotel/distro/config.py#L95-L104
 */
export function getSafeEdotEnv(): {};
