#!/usr/bin/env bash

# Extract release notes for the given package (at the current version)
# from $PKG_DIR/CHANGELOG.md and write to "build/release-notes.md".
# This is used for the body of a GitHub release.
#
# This exits non-zero if it could not extract, e.g. on a version mismatch.
#
# Usage:
#   ./scripts/extract-release-notes.sh PKG_DIR
# Example:
#   ./scripts/extract-release-notes.sh packages/opentelemetry-node

if [ "$TRACE" != "" ]; then
    export PS4='${BASH_SOURCE}:${LINENO}: ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
    set -o xtrace
fi
set -euo pipefail

function fatal {
    echo "$(basename $0): error: $*" >&2
    exit 1
}

TOP=$(cd $(dirname $0)/../ >/dev/null; pwd)
JSON=$TOP/node_modules/.bin/json
BUILD_DIR=$TOP/build

PKG_DIR="$1"
if [[ ! -f "$PKG_DIR/package.json" ]]; then
  fatal "invalid PKG_DIR arg: '$PKG_DIR/package.json' does not exist"
fi

PKG_NAME=$($JSON -f "$PKG_DIR/package.json" name)
PKG_VER=$($JSON -f "$PKG_DIR/package.json" version)

# Extract the changelog section for this version.
mkdir -p $BUILD_DIR
cat $PKG_DIR/CHANGELOG.md \
  | sed -n -e '/^## v'$PKG_VER'$/,/^## /p' \
  | sed -e '/^##/d' \
  > $BUILD_DIR/release-notes1.md
if [[ -z "$(cat $BUILD_DIR/release-notes1.md)" ]]; then
  fatal "empty release notes: could not find /^## v$PKG_VER\$/ section in '$PKG_DIR/CHANGELOG.md'"
fi
echo "## Changelog" >$BUILD_DIR/release-notes.md
cat $BUILD_DIR/release-notes1.md >>$BUILD_DIR/release-notes.md
