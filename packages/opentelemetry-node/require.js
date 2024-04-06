// Register ESM hook and start the SDK.
// This is called for `--require @elastic/opentelemetry-node`.

const register = require('module').register;
const {pathToFileURL} = require('url');
const {isMainThread} = require('worker_threads');

if (isMainThread) {
    // XXX logging
    if (typeof register === 'function') {
        // XXX also protect against double registering of the loader, if the user also
        //     adds `--loader=./hook.mjs` because we'll want to support that.
        //     What *does* happen with double registering of the IITM loader?
        register('./hook.mjs', pathToFileURL(__filename).toString());
    }

    require('./lib/start.js');
}
