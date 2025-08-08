/**
 * A "setter" is a function that applies one or more config keys.
 *
 * - A config value of `undefined` means that the setting should be reset to its default value.
 * - After setting the value: `log.info('central-config: ...')`
 * - If there is an error applying the value, an error message string must be returned.
 */
export type RemoteConfigHandler = {
    keys: string[];
    setter: (config: any, sdkInfo: any) => string | null;
};
/**
 * Setup an OpAMP client, if configured to use one.
 *
 * TODO: type for sdkInfo
 *
 * @returns {object | null} OpAMPClient, if configured to use one.
 */
export function setupCentralConfig(sdkInfo: any): object | null;
