#!/usr/bin/env node

/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Extract release notes for the given package (at the current version) and
// write to "build/release-notes.md".  This is used for the body of a GitHub
// release.
//
// This exits non-zero if it could not extract, e.g. on a version mismatch.
//
// Usage:
//   ./scripts/extract-release-notes.js PKG_DIR
// Example:
//   ./scripts/extract-release-notes.js packages/opentelemetry-node

const assert = require('assert/strict');
const path = require('path');
const fs = require('fs');
const {mkdirp} = require('mkdirp');
const {exec} = require('child_process');

const TOP = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(TOP, 'build');

function extractText(p, reStart, reEnd) {
    let text = fs.readFileSync(p, 'utf8');

    let idx = text.search(reStart);
    if (idx === -1) {
        throw new Error(`could not find ${reStart} in "${p}"`);
    }
    text = text.slice(idx);

    // Drop the header line.
    idx = text.search('\n');
    text = text.slice(idx + 1);

    idx = text.search(reEnd);
    text = text.slice(0, idx).trim();

    return text;
}

async function getBranch() {
    return new Promise((resolve, reject) => {
        exec(
            'git symbolic-ref HEAD',
            {
                cwd: TOP,
            },
            (err, stdout, _stderr) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(stdout.trim().split('/').pop());
                }
            }
        );
    });
}

function stripDocsV3Syntax(s) {
    // Drop docsv3 explicit anchors on header lines.
    s = s
        .replace(/^## (.*) \[.*\]$/gm, '## $1')
        .replace(/^### (.*)\s+\[.*\]$/gm, '### $1');

    // Drop `::::{dropdown} ... ::::` syntax being used for separate bullets
    // in breaking-changes.md.
    s = s.replace(/^::::{dropdown} /, '- ');

    return s;
}

async function main() {
    const pkgDir = process.argv[2];
    assert.ok(pkgDir, 'missing PKG_DIR argument');
    const pj = JSON.parse(
        fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')
    );

    await mkdirp(BUILD_DIR);

    const dest = path.join(BUILD_DIR, 'release-notes.md');
    if (path.posix.resolve(pkgDir).endsWith('/packages/opentelemetry-node')) {
        // docsv3-syntax release notes in "docs/release-notes/..."
        const chunks = [];
        try {
            const breaking = extractText(
                path.join(TOP, 'docs/release-notes/breaking-changes.md'),
                new RegExp(`^## ${pj.version}$`, 'm'),
                new RegExp(`^## `, 'm')
            );
            chunks.push(
                '### Breaking changes\n\n',
                stripDocsV3Syntax(breaking),
                '\n\n'
            );
        } catch (err) {
            // Pass. Just don't have breaking changes in this release.
        }

        const relnotes = extractText(
            path.join(TOP, 'docs/release-notes/index.md'),
            new RegExp(`^## ${pj.version} `, 'm'),
            new RegExp(`^## `, 'm')
        );
        chunks.push(stripDocsV3Syntax(relnotes));

        const branch = await getBranch();
        const readmeUrl = `https://github.com/elastic/elastic-otel-node/tree/${branch}/${pkgDir}#readme`;
        const relnotesUrl = `https://github.com/elastic/elastic-otel-node/blob/${branch}/docs/release-notes/index.md`;
        const breakingUrl = `https://github.com/elastic/elastic-otel-node/blob/${branch}/docs/release-notes/breaking-changes.md`;
        fs.writeFileSync(
            dest,
            `## Changelog

${chunks.join('')}

---

[README](${readmeUrl}) | [Full Release Notes](${relnotesUrl}) | [Breaking Changes](${breakingUrl})
`,
            'utf8'
        );
    } else {
        // Markdown changelog in "$pkgDir/CHANGELOG.md"
        const relnotes = extractText(
            path.join(pkgDir, 'CHANGELOG.md'),
            new RegExp(`^## v${pj.version}$`, 'm'),
            new RegExp(`^## `, 'm')
        );

        const branch = await getBranch();
        const readmeUrl = `https://github.com/elastic/elastic-otel-node/tree/${branch}/${pkgDir}#readme`;
        const changelogUrl = `https://github.com/elastic/elastic-otel-node/blob/${branch}/${pkgDir}/CHANGELOG.md`;
        fs.writeFileSync(
            dest,
            `## Changelog

${relnotes}

---

[README](${readmeUrl}) | [Full Changelog](${changelogUrl})
`,
            'utf8'
        );
    }
}

main();
