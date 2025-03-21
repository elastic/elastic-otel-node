#!/usr/bin/env node

/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A small script to aid with maintaining/generating src/semconv.ts.
 *
 * Currently this assumes that `@opentelemetry/semantic-conventions` is
 * installed, which isn't a great assumption.
 *
 * Usage:
 * 1. Update any used semconv constants in `names` below.
 * 2. Run `./scripts/semconv-gen.js`.
 * 3. Use that output to help update `src/semconv.ts`. Nothing fancy.
 */

const incubating = require('@opentelemetry/semantic-conventions/incubating');

const names = `
// stable
ATTR_SERVER_ADDRESS
ATTR_SERVER_PORT

// unstable
ATTR_EVENT_NAME
ATTR_GEN_AI_OPERATION_NAME
ATTR_GEN_AI_REQUEST_FREQUENCY_PENALTY
ATTR_GEN_AI_REQUEST_MAX_TOKENS
ATTR_GEN_AI_REQUEST_MODEL
ATTR_GEN_AI_REQUEST_PRESENCE_PENALTY
ATTR_GEN_AI_REQUEST_TOP_P
ATTR_GEN_AI_RESPONSE_FINISH_REASONS
ATTR_GEN_AI_RESPONSE_ID
ATTR_GEN_AI_RESPONSE_MODEL
ATTR_GEN_AI_SYSTEM
ATTR_GEN_AI_TOKEN_TYPE
ATTR_GEN_AI_USAGE_INPUT_TOKENS
ATTR_GEN_AI_USAGE_OUTPUT_TOKENS
METRIC_GEN_AI_CLIENT_OPERATION_DURATION
METRIC_GEN_AI_CLIENT_TOKEN_USAGE

// not yet in published @opentelemetry/semantic-conventions package
ATTR_GEN_AI_REQUEST_ENCODING_FORMATS
`
  .trim()
  .split(/\n/g)
  .map(line => {
    const commentIdx = line.indexOf('//');
    if (commentIdx !== -1) {
      line = line.slice(0, commentIdx);
    }
    return line.trim();
  });

for (let name of names) {
  if (!name) {
    process.stdout.write('\n');
    continue;
  }
  const val = incubating[name];
  switch (typeof val) {
    case 'undefined':
      console.log(
        `exports const ${name} = ???; // not in the installed semconv pkg`
      );
      break;
    case 'string':
      console.log(`export const ${name} = '${val}';`);
      break;
    case 'number': // e.g. RPC_GRPC_STATUS_CODE_VALUE_OUT_OF_RANGE
    // falls through
    case 'function': // e.g. ATTR_RPC_GRPC_RESPONSE_METADATA
      console.log(`export const ${name} = ${val};`);
      break;
    default:
      throw new Error(`WAT semconv "${name}" type: ${typeof val}`);
  }
}
