/**
 * Tweak `process.env` before calling NodeSDK.
 */
export function setupEnvironment(): void;
/**
 * Restores any `process.env` stashed in `setupEnvironment()`.
 */
export function restoreEnvironment(): void;
