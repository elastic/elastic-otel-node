// Register ESM hook and start the SDK.
// This is called for `--require @elastic/opentelemetry-node`.

const register = require('module').register;
const {pathToFileURL} = require('url');
const {isMainThread} = require('worker_threads');

function haveHookFromExperimentalLoader() {
    const PATTERN =
        /--(experimental-)?loader\s*=?\s*@elastic\/opentelemetry-node\/hook.mjs/;
    for (let i = 0; i < process.execArgv.length; i++) {
        const arg = process.execArgv[i];
        const nextArg = process.execArgv[i + 1];
        if (
            (arg === '--loader' || arg === '--experimental-loader') &&
            nextArg === '@elastic/opentelemetry-node/hook.mjs'
        ) {
            // process._rawDebug('XXX yup: [%s, %s]', arg, nextArg);
            return true;
        } else if (PATTERN.test(arg)) {
            // process._rawDebug('XXX yup: [%s]', arg);
            return true;
        }
    }
    if (process.env.NODE_OPTIONS && PATTERN.test(process.env.NODE_OPTIONS)) {
        // process._rawDebug('XXX yup: NODE_OPTIONS');
        return true;
    }
    return false;
}

if (isMainThread) {
    // XXX logging

    if (typeof register === 'function' && !haveHookFromExperimentalLoader()) {
        process._rawDebug('XXX require.js: module.register ESM hook');
        register('./hook.mjs', pathToFileURL(__filename).toString());
    }

    require('./lib/start.js');
}
