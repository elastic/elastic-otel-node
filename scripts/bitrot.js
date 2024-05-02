#!/usr/bin/env node

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const semver = require('semver');

const ETEL_PJ_PATH = path.resolve(
    __dirname,
    '..',
    'packages',
    'opentelemetry-node',
    'package.json'
);
const AIN_PJ_URL =
    'https://raw.githubusercontent.com/open-telemetry/opentelemetry-js-contrib/main/metapackages/auto-instrumentations-node/package.json';
const SKIP_INSTR_NAMES = [
    '@opentelemetry/instrumentation-aws-lambda', // supported versions isn't meaningful
    '@opentelemetry/instrumentation-redis', // the separate 'instrumentation-redis-4' handles the latest versions
];
const QUIET = true;

let gRotCount = 0;

// ---- caching

const gCachePath = '/tmp/eon-bitrot.cache.json';
let gCache = null;

function ensureCacheLoaded(ns) {
    if (gCache === null) {
        try {
            gCache = JSON.parse(fs.readFileSync(gCachePath));
        } catch (loadErr) {
            gCache = {};
        }
    }
    if (!(ns in gCache)) {
        gCache[ns] = {};
    }
    return gCache[ns];
}

function saveCache() {
    if (gCache !== null) {
        fs.writeFileSync(gCachePath, JSON.stringify(gCache, null, 2));
    }
}

// ---- minimal ANSI styling support (from bunyan)

// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
// Suggested colors (some are unreadable in common cases):
// - Good: cyan, yellow (limited use, poor visibility on white background),
//   bold, green, magenta, red
// - Bad: blue (not visible on cmd.exe), grey (same color as background on
//   Solarized Dark theme from <https://github.com/altercation/solarized>, see
//   issue #160)
var colors = {
    bold: [1, 22],
    italic: [3, 23],
    underline: [4, 24],
    inverse: [7, 27],
    white: [37, 39],
    grey: [90, 39],
    black: [30, 39],
    blue: [34, 39],
    cyan: [36, 39],
    green: [32, 39],
    magenta: [35, 39],
    red: [31, 39],
    yellow: [33, 39],
};

function stylizeWithColor(str, color) {
    if (!str) {
        return '';
    }
    var codes = colors[color];
    if (codes) {
        return '\x1B[' + codes[0] + 'm' + str + '\x1B[' + codes[1] + 'm';
    } else {
        return str;
    }
}

function stylizeWithoutColor(str, color) {
    return str;
}

let stylize = stylizeWithColor;

// ---- support functions

function rot(moduleName, s) {
    gRotCount++;
    console.log(`${stylize(moduleName, 'bold')} bitrot: ${s}`);
}

function getNpmInfo(name) {
    const CACHE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    const cache = ensureCacheLoaded('npmInfo');
    const cacheEntry = cache[name];
    if (cacheEntry) {
        if (cacheEntry.timestamp + CACHE_TIMEOUT_MS > Date.now()) {
            return cacheEntry.value;
        } else {
            delete cache[name];
        }
    }

    // Limited security guard on exec'ing given `name`.
    const PKG_NAME_RE = /^(@[\w_.-]+\/)?([\w_.-]+)$/;
    if (!PKG_NAME_RE.test(name)) {
        throw new Error(
            `${JSON.stringify(
                name
            )} does not look like a valid npm package name`
        );
    }

    const stdout = execSync(`npm info -j "${name}"`);
    const npmInfo = JSON.parse(stdout);

    cache[name] = {
        timestamp: Date.now(),
        value: npmInfo,
    };
    saveCache();
    return npmInfo;
}

function bitrot() {
    const pj = JSON.parse(fs.readFileSync(ETEL_PJ_PATH, 'utf8'));
    const instrNames = Object.keys(pj.dependencies).filter((d) =>
        d.startsWith('@opentelemetry/instrumentation-')
    );

    const ainPj = getNpmInfo('@opentelemetry/auto-instrumentations-node');
    const ainInstrNames = Object.keys(ainPj.dependencies).filter((d) =>
        d.startsWith('@opentelemetry/instrumentation-')
    );

    for (let instrName of ainInstrNames) {
        if (SKIP_INSTR_NAMES.includes(instrName)) continue;
        if (!instrNames.includes(instrName)) {
            rot(instrName, 'missing instr that auto-instrumentations-node has');
        }
    }

    for (let instrName of instrNames) {
        if (SKIP_INSTR_NAMES.includes(instrName)) continue;

        if (!QUIET) console.log(`${instrName}:`);
        const mod = require(instrName);
        const instrClass = Object.keys(mod).filter((n) =>
            n.endsWith('Instrumentation')
        )[0];
        const instr = new mod[instrClass]();
        const initVal = instr.init(); // XXX grpc is weird here
        if (initVal === undefined) {
            if (!QUIET) console.log(`    (instr.init() returned undefined!)`);
            continue;
        }
        const instrNodeModuleFiles = Array.isArray(initVal)
            ? initVal
            : [initVal];

        const supVersFromModName = {};
        for (let inmf of instrNodeModuleFiles) {
            // TODO: warn if supportedVersions range is open-ended. E.g. if it satisfies 9999.9999.9999 or something.
            if (!QUIET)
                console.log(
                    `    ${inmf.name}: ${JSON.stringify(
                        inmf.supportedVersions
                    )}`
                );
            // XXX keep printing these? Do they ever matter?
            for (let file of inmf.files) {
                if (!QUIET)
                    console.log(
                        `        ${file.name}: ${JSON.stringify(
                            file.supportedVersions
                        )}`
                    );
            }
            if (!supVersFromModName[inmf.name]) {
                supVersFromModName[inmf.name] = [];
            }
            supVersFromModName[inmf.name].push(inmf.supportedVersions);
        }
        for (let modName of Object.keys(supVersFromModName)) {
            const supVers = supVersFromModName[modName].flat();
            if (supVers.toString() === '*') {
                // This is code for "node core module".
                continue;
            }
            const info = getNpmInfo(modName);
            const latest = info['dist-tags'].latest;
            if (!QUIET)
                console.log(`    latest published: ${modName}@${latest}`);
            let supsLatest = false;
            for (let range of supVers) {
                if (semver.satisfies(latest, range)) {
                    supsLatest = true;
                }
            }
            if (!supsLatest) {
                rot(
                    instrName,
                    `supportedVersions of module "${modName}" (${JSON.stringify(
                        supVers
                    )}) do not support the latest published ${modName}@${latest}`
                );
            }
        }
    }
}

function main(argv) {
    bitrot();

    if (gRotCount > 0) {
        process.exit(3);
    }
}

if (require.main === module) {
    main(process.argv);
}
