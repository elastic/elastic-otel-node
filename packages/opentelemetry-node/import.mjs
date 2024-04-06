// Register ESM hook and start the SDK.
// This is called for `--import @elastic/opentelemetry-node`.

import module from 'node:module';
import {isMainThread} from 'node:worker_threads';

if (isMainThread) {
    // XXX logging
    if (typeof module.register === 'function') {
        // XXX also protect against double registering of the loader, if the user also
        //     adds `--loader=./hook.mjs` because we'll want to support that.
        //     What *does* happen with double registering of the IITM loader?
        module.register('./hook.mjs', import.meta.url);
    }

    await import('./lib/start.js');
}
