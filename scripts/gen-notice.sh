#!/bin/bash
#
# This script generates a NOTICE file for a distribution of a package in this
# repo. It also supports running in lint mode, via `--lint`, where it will not
# emit content, but will error out if there is a licensing issue (i.e. an
# included dependency is licensed with an unknown license).
#
# The purpose of the NOTICE file is to list the licenses of all included code.
# Here a "distribution" is a packaging of a package in this repo **with its
# dependencies**; as opposed to what is published to npm.
#
# Usage:
#   ./dev-utils/gen-notice.sh DIST_DIR
#   ./dev-utils/gen-notice.sh --lint DIST_DIR   # lint mode
#
# where DIST_DIR is the distribution directory (the dir that holds the
# "package.json" and "node_modules/" dir).
#

if [ "$TRACE" != "" ]; then
    export PS4='${BASH_SOURCE}:${LINENO}: ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
    set -o xtrace
fi
set -o errexit
set -o pipefail

# ---- support functions

function warn {
    echo "$(basename $0): warn: $*" >&2
}

function fatal {
    echo "$(basename $0): error: $*" >&2
    exit 1
}

# ---- mainline

if [[ "$1" == "--lint" ]]; then
    LINT_MODE=true
    OUTFILE=/dev/null
    shift
else
    LINT_MODE=false
    OUTFILE=/dev/stdout
fi
DIST_DIR="$1"
[[ -n "$DIST_DIR" ]] || fatal "missing DIST_DIR argument"
[[ -f "$DIST_DIR/package.json" ]] || fatal "invalid DIST_DIR: $DIST_DIR/package.json does not exist"

# Guard against accidentally using this script with a too-old npm (<v8.7.0).
npmVer=$(npm --version)
npmMajorVer=$(echo "$npmVer" | cut -d. -f1)
npmMinorVer=$(echo "$npmVer" | cut -d. -f2)
if [[ $npmMajorVer -lt 8 || ($npmMajorVer -eq 8 && $npmMinorVer -lt 7) ]]; then
    fatal "npm version is too old for 'npm ls --omit=dev': $npmVer"
fi

# Directory holding some "license.*.txt" files for inclusion below.
export MANUAL_LIC_DIR=$(cd $(dirname $0)/ >/dev/null; pwd)

cat $DIST_DIR/NOTICE.md >$OUTFILE

# Emit a Markdown section listing the license for each non-dev dependency
# in the DIST_DIR. This errors out if a license cannot be found or isn't known.
cd $DIST_DIR
npm ls --omit=dev --all --parseable \
    | node -e '
        const fs = require("fs")
        const path = require("path")
        const knownLicTypes = {
            "Apache-2.0": true,
            "ISC": true,
            "MIT": true,
            "BSD-2-Clause": true,
            "BSD-3-Clause": true,
            "(Apache-2.0 AND BSD-3-Clause)": true,
        }
        // We handle getting the license text for a few specific deps that
        // do not include one in their install.
        const licFileFromPkgName = {
            "acorn-import-assertions": "license.MIT.txt",
            "assert-plus": "license.assert-plus.txt",
            "pg-types": "license.pg-types.txt",
            "undici-types": "license.undici.txt",
            "tr46": "license.MIT.txt",
            "@bufbuild/protobuf": "license.apache2.txt",
            "safe-json-stringify": "license.MIT.txt",
        }
        const licTypeFromPkgName = {
            // instr-openai will get the license field in https://github.com/elastic/elastic-otel-node/pull/1015
            "@opentelemetry/instrumentation-openai": "Apache-2.0",
        }
        const allowNoLicFile = [
            "binary-search" // CC is a public domain dedication, no need for license text.
        ]
        const chunks = []
        process.stdin.on("data", chunk => chunks.push(chunk))
        process.stdin.on("end", () => {
            console.log("\n\n# Notice for distributed packages")
            const depDirs = chunks.join('').trim().split(/\n/g)
            depDirs.shift() // Drop first dir, it is elastic-apm-node.
            depDirs.forEach(depDir => {
                const pj = require(`${depDir}/package.json`)
                let licType = pj.license
                if (!licType && pj.licenses) {
                    licType = pj.licenses
                        .map(licObj => licObj.type)
                        .filter(licType => knownLicTypes[licType])[0]
                }
                if (!licType && licTypeFromPkgName[pj.name]) {
                    licType = licTypeFromPkgName[pj.name]
                }
                if (!licType) {
                    throw new Error(`cannot determine license for ${pj.name}@${pj.version} in ${depDir}`)
                } else if (!knownLicTypes[licType]) {
                    throw new Error(`license for ${pj.name}@${pj.version} in ${depDir} is not known: "${licType}"`)
                }
                console.log(`\n## ${pj.name}@${pj.version} (${licType})`)

                let licPath
                // npm-packlist always includes any file matching "licen[cs]e.*"
                // (case-insensitive) as a license file. However some of our
                // deps use "LICENSE-MIT.*", which we need to allow as well.
                const dir = fs.opendirSync(depDir)
                let dirent
                while (dirent = dir.readSync()) {
                    if (dirent.isFile() && /^licen[cs]e(-\w+)?(\..*)?$/i.test(dirent.name)) {
                        licPath = path.join(depDir, dirent.name)
                        break
                    }
                }
                dir.close()
                if (!licPath && licFileFromPkgName[pj.name]) {
                    licPath = path.join(process.env.MANUAL_LIC_DIR, licFileFromPkgName[pj.name])
                }
                if (!licPath && !allowNoLicFile.includes(path.basename(depDir))) {
                    throw new Error(`cannot find license file for ${pj.name}@${pj.version} in ${depDir}`)
                }
                if (licPath) {
                    console.log("\n```\n" + fs.readFileSync(licPath, "utf8").trimRight() + "\n```")
                }
            })
        })
    ' >>$OUTFILE
