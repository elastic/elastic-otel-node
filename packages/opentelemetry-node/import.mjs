// --import=module
// Added in: v19.0.0, v18.18.0

// https://nodejs.org/api/module.html#customization-hooks
// https://nodejs.org/api/module.html#moduleregisterspecifier-parenturl-options
// v20.8.0 	Add support for WHATWG URL instances.
// v20.6.0 	Added in: v20.6.0
import {register} from 'node:module';

console.log('hi from import.mjs');

// XXX TODO: guard on supported node versions (v20.6.0 I think?)
// XXX also protect against double registering of the loader, if the user also
//     adds `--loader=./loader.mjs` because we'll want to support that.
//     What *does* happen with double registering of the IITM loader?
register('./loader.mjs', import.meta.url);

await import('./start.js');
