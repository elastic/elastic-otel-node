#!/usr/bin/env node

/**
 * Update '@opentelemetry/*' deps in all workspaces.
 *
 * Usage:
 *      node scripts/update-otel-deps.js [WORKSPACES...]
 */

const path = require('path');
const {execFileSync, spawnSync} = require('child_process');
const {globSync} = require('glob');

const pj = require(path.resolve(__dirname, '../package.json'));

function updateOTelDeps(workspace) {
    const p = spawnSync('npm', ['outdated', '--json'], {
        cwd: workspace,
        encoding: 'utf8',
    });
    const outdated = JSON.parse(p.stdout);

    const npmArgs = [];
    Object.keys(outdated).forEach((pkgName) => {
        if (!pkgName.startsWith('@opentelemetry/')) {
            return;
        }
        npmArgs.push(`${pkgName}@${outdated[pkgName].latest}`);
    });
    if (npmArgs.length > 0) {
        console.log(`cd ${workspace} && npm install ${npmArgs.join(' ')}`);
        npmArgs.unshift('install');
        execFileSync('npm', npmArgs, {
            cwd: workspace,
            encoding: 'utf8',
        });
    }
}

async function main() {
    let allWorkspaces = pj.workspaces.map((w) => globSync(w)).flat();
    let workspaces = allWorkspaces;
    if (process.argv.length > 2) {
        workspaces = process.argv
            .slice(2)
            .map((s) => globSync(s))
            .flat()
            .filter((s) => allWorkspaces.includes(s));
    }

    workspaces.forEach((w) => {
        updateOTelDeps(w);
    });
}

main();
