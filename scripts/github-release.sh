#!/usr/bin/env bash

# Create a GitHub release.
# (This is typically only run from the release.yml CI workflow.)
#
# The release will be marked as the "latest" if:
# (a) PKG_DIR is "packages/opentelemetry-node", the primary package in this repo, and
# (b) the given TAG_NAME is the *latest* "vX.Y.Z" tag, and is not a pre-release.
#
# - For auth, this expects the 'GH_TOKEN' envvar to have been set.
# - The 'TAG_NAME' is typically from the 'GITHUB_REF_NAME' variable
#   (https://docs.github.com/en/actions/learn-github-actions/variables)
#   from a GitHub Actions workflow run.
#
# Usage:
#   ./scripts/github-release.sh PKG_DIR TAG_NAME
# Examples:
#   ./scripts/github-release.sh packages/opentelemetry-node v0.1.0
#   ./scripts/github-release.sh packages/mockotlpserver mockotlpserver-v0.2.0

if [ "$TRACE" != "" ]; then
    export PS4='${BASH_SOURCE}:${LINENO}: ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
    set -o xtrace
fi
set -euo pipefail

function fatal {
    echo "$(basename $0): error: $*" >&2
    exit 1
}

readonly PKG_DIR="$1"
readonly TAG_NAME="$2"

TOP=$(cd $(dirname $0)/../ >/dev/null; pwd)
JSON=$TOP/node_modules/.bin/json

if [[ ! -f "$PKG_DIR/package.json" ]]; then
  fatal "invalid PKG_DIR arg: '$PKG_DIR/package.json' does not exist"
fi
if [[ -z $(git tag -l "${TAG_NAME}") ]]; then
  fatal "invalid TAG_NAME arg: '$TAG_NAME' git tag does not exist"
fi

PKG_DIR_BASENAME=$(basename "$PKG_DIR")
PKG_NAME=$($JSON -f "$PKG_DIR/package.json" name)
PKG_VER=$($JSON -f "$PKG_DIR/package.json" version)
EXPECTED_TAG_NAME="v$PKG_VER"
if [[ "$PKG_DIR" != "packages/opentelemetry-node" ]]; then
  EXPECTED_TAG_NAME="$(basename "$PKG_DIR")-v$PKG_VER"
fi
if [[ "$TAG_NAME" != "$EXPECTED_TAG_NAME" ]]; then
  fatal "TAG_NAME, '$TAG_NAME', does not match expected value, '$EXPECTED_TAG_NAME'"
fi

# Extract the changelog section for this version.
$TOP/scripts/extract-release-notes.js $PKG_DIR
echo "INFO: Extracted changelog"
echo "--"
cat build/release-notes.md
echo "--"

echo
echo "INFO: List current GitHub releases"
gh release list

IS_LATEST=false
# The latest (by semver version ordering) git version tag, excluding pre-releases.
LATEST_GIT_TAG=$(git tag --list --sort=version:refname "v*" | (grep -v - || true) | tail -n1)
if [[ "$PKG_DIR" == "packages/opentelemetry-node" ]]; then
  if [[ -z "$LATEST_GIT_TAG" || "$TAG_NAME" == "$LATEST_GIT_TAG" ]]; then
    IS_LATEST=true
  fi
fi

echo
echo "INFO: Creating '$PKG_NAME $TAG_NAME' GitHub release (latest=$IS_LATEST)"
gh release create "$TAG_NAME" \
  --title "$PKG_NAME $PKG_VER" \
  --notes-file build/release-notes.md \
  --latest=$IS_LATEST
