#!/usr/bin/env node

/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Update '@opentelemetry/*' deps in a package.
 *
 * Usage:
 *      nvm use 24  # use a recent npm version
 *      cd packages/FOO
 *      npm ci
 *      node ../../scripts/update-otel-deps.js
 *
 * You can set the `DEBUG=1` envvar to get some debug output.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const {minimatch} = require('minimatch');
const semver = require('semver');

const TOP = process.cwd();

function debug(...args) {
    if (process.env.DEBUG) {
        console.log(...args);
    }
}

function datestamp() {
    return new Date().toISOString().split('T')[0].replace(/-/g, '');
}

/**
 * Update dependencies & devDependencies in this npm package.
 * Use `patterns` to limit to a set of matching package names.
 *
 * Compare somewhat to dependabot group version updates:
 *  https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#groups
 * However IME with opentelemetry-js-contrib.git, dependabot will variously
 * timeout, not update all deps, or leave an unsync'd package-lock.json.
 *
 * See https://gist.github.com/trentm/e67fb941a4aca339c2911d873b2e8ab6 for
 * notes on some perils with using 'npm outdated'.
 *
 * @param {object} opts
 * @param {string[]} opts.patterns - An array of glob-like patterns to match
 *      against dependency names. E.g. `["@opentelemetry/*"]`.
 * @param {boolean} [opts.allowRangeBumpFor0x] - By default this update only
 *      targets the latest available version that matches the current
 *      package.json range. Setting this to true allows any deps currently at an
 *      0.x version to be bumped to the latest, even if the latest doesn't
 *      satisfy the current range. E.g. `^0.41.0` will be bumped to `0.42.0` or
 *      `1.2.3` or `2.3.4` if that is the latest published version. This means
 *      using `npm install ...` and changing the range in "package.json".
 * @param {boolean} [opts.dryRun] - Note that a dry-run might not fully
 *      accurately represent the commands run, because the final 'npm update'
 *      args can depend on the results of earlier 'npm install' commands.
 */
function updateNpmDeps({patterns, allowRangeBumpFor0x, dryRun}) {
    assert(
        patterns && patterns.length > 0,
        'must provide one or more patterns'
    );

    const pkgDir = '.'; // assuming cwd
    const matchStr = ` matching "${patterns.join('", "')}"`;
    console.log(`Updating deps${matchStr}`);

    const depPatternFilter = (name) => {
        for (let pat of patterns) {
            if (minimatch(name, pat)) {
                return true;
            }
        }
        return false;
    };

    // Gather deps info.
    const pj = JSON.parse(
        fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')
    );
    const deps = {};
    if (pj.dependencies) {
        Object.keys(pj.dependencies)
            .filter(depPatternFilter)
            .forEach((d) => {
                deps[d] = pj.dependencies[d];
            });
    }
    if (pj.devDependencies) {
        Object.keys(pj.devDependencies)
            .filter(depPatternFilter)
            .forEach((d) => {
                deps[d] = pj.devDependencies[d];
            });
    }
    const pkgInfo = {
        name: pj.name,
        deps,
    };
    debug('pkgInfo: ', pkgInfo);

    console.log('\nGathering info on outdated deps:');
    const summaryStrs = new Set();
    const npmInstallTasks = [];
    const npmUpdatePkgNames = new Set();
    const depNames = Object.keys(pkgInfo.deps);
    if (depNames.length === 0) {
        return;
    }
    // We use 'npm outdated -j ...' as a quick way to get the current
    // installed version and latest published version of deps. The '-j'
    // output shows a limited/random subset of data such that its `wanted`
    // value cannot be used (see "npm outdated" perils above).
    const p = spawnSync('npm', ['outdated', '--json'].concat(depNames), {
        cwd: pkgDir,
        encoding: 'utf8',
    });
    const outdated = JSON.parse(p.stdout);
    if (Object.keys(outdated).length === 0) {
        return;
    }
    const npmInstallArgs = [];
    for (let depName of depNames) {
        if (!(depName in outdated)) {
            continue;
        }
        const anOutdatedEntry = Array.isArray(outdated[depName])
            ? outdated[depName][0]
            : outdated[depName];
        const currVer = anOutdatedEntry.current;
        const latestVer = anOutdatedEntry.latest;
        if (semver.satisfies(latestVer, pkgInfo.deps[depName])) {
            // `npm update` should suffice.
            npmUpdatePkgNames.add(depName);
            summaryStrs.add(`${currVer} -> ${latestVer} ${depName}`);
        } else if (semver.lt(currVer, '1.0.0')) {
            if (allowRangeBumpFor0x) {
                npmInstallArgs.push(`${depName}@${latestVer}`);
                summaryStrs.add(
                    `${currVer} -> ${latestVer} ${depName} (range-bump)`
                );
            } else {
                console.warn(
                    `WARN: not updating dep "${depName}" in "${pkgDir}" to latest: currVer=${currVer}, latestVer=${latestVer}, package.json dep range="${pkgInfo.deps[depName]}" (use allowRangeBumpFor0x=true to supporting bumping 0.x deps out of package.json range)`
                );
            }
        } else {
            // TODO: Add support for finding a release other than latest that satisfies the package.json range.
            console.warn(
                `WARN: dep "${depName}" in "${pkgDir}" cannot be updated to latest: currVer=${currVer}, latestVer=${latestVer}, package.json dep range="${pkgInfo.deps[depName]}" (this script does not yet support finding a possible published ver to update to that does satisfy the package.json range)`
            );
        }
    }
    if (npmInstallArgs.length > 0) {
        npmInstallTasks.push({
            cwd: pkgDir,
            argv: ['npm', 'install'].concat(npmInstallArgs),
        });
    }

    console.log(
        '\nPerforming updates (%d `npm install ...`s, %d `npm update ...`):',
        npmInstallTasks.length,
        npmUpdatePkgNames.size ? 1 : 0
    );
    debug('npmInstallTasks: ', npmInstallTasks);
    debug('npmUpdatePkgNames: ', npmUpdatePkgNames);
    for (let task of npmInstallTasks) {
        console.log(` $ cd ${task.cwd} && ${task.argv.join(' ')}`);
        if (!dryRun) {
            const p = spawnSync(task.argv[0], task.argv.slice(1), {
                cwd: task.cwd,
                encoding: 'utf8',
            });
            if (p.error) {
                throw p.error;
            } else if (p.status !== 0) {
                const err = Error(`'npm install' failed (status=${p.status})`);
                err.cwd = task.cwd;
                err.argv = task.argv;
                err.process = p;
                throw err;
            }
            // Note: As noted at https://github.com/open-telemetry/opentelemetry-js-contrib/issues/1917#issue-2109198809
            // (see "... requires running npm install twice ...") in some cases this
            // 'npm install' doesn't actually install the new version, but do not
            // error out!
            // TODO: guard against this with 'npm ls' or package.json check?
        }
    }

    if (npmUpdatePkgNames.size > 0) {
        console.log(` $ npm update ${Array.from(npmUpdatePkgNames).join(' ')}`);
        if (!dryRun) {
            const p = spawnSync(
                'npm',
                ['update'].concat(Array.from(npmUpdatePkgNames)),
                {
                    cwd: TOP,
                    encoding: 'utf8',
                }
            );
            if (p.error) {
                throw p.error;
            }
        }
    }

    console.log('\nSanity check that all matching packages are up-to-date:');
    if (dryRun) {
        console.log('  (Skipping sanity check for dry-run.)');
    } else {
        const allDeps = new Set(Object.keys(pkgInfo.deps));
        console.log(` $ npm outdated ${Array.from(allDeps).join(' ')}`);
        const p = spawnSync('npm', ['outdated'].concat(Array.from(allDeps)), {
            cwd: TOP,
            encoding: 'utf8',
        });
        if (p.status !== 0) {
            // Only *warning* here because the user might still want to commit
            // what *was* updated.
            console.warn(`WARN: not all packages${matchStr} were fully updated:
  *** 'npm outdated' exited non-zero, stdout: ***
  ${p.stdout.trimEnd().split('\n').join('\n  ')}
  ***`);
        }
    }

    // Summary/commit message.
    let commitMsg = `chore(deps): update deps${matchStr}\n\nSummary of changes:\n\n`;
    commitMsg +=
        '    ' +
        Array.from(summaryStrs)
            .sort((a, b) => {
                const aParts = a.split(' ');
                const bParts = b.split(' ');
                return (
                    semver.compare(aParts[0], bParts[0]) ||
                    (aParts[3] > bParts[3] ? 1 : -1)
                );
            })
            .join('\n    ');
    console.log(
        `\nPossible commands to create a PR for these changes:
\`\`\`
git checkout -b ${process.env.USER}/update-otel-deps-${datestamp()}
git commit -am '${commitMsg}
'
gh pr create --fill -w
\`\`\`
`
    );
}

async function main() {
    updateNpmDeps({
        patterns: ['@opentelemetry/*'],
        allowRangeBumpFor0x: true,
        dryRun: false,
    });
}

main();
