// XXX
// import {isMainThread} from 'node:worker_threads';
// process._rawDebug(
//     'hook.mjs: isMainThread=%s stack=',
//     isMainThread,
//     new Error().stack
// );

export {
    load,
    resolve,
    getFormat,
    getSource,
} from '@opentelemetry/instrumentation/hook.mjs';
