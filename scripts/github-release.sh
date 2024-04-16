#!/usr/bin/env bash

# Create a GitHub release. If the given tag name is the *latest* version, and
# is not a pre-release, then the GH release will be marked as the latest.
# (This is typically only run from the release.yml CI workflow.)
#
# Usage:
#   ./scripts/github-release.sh PKG_DIR TAG_NAME DRY_RUN
# Example:
#   ./scripts/github-release.sh packages/opentelemetry-node v0.1.0 true
#
# - For auth, this expects the 'GH_TOKEN' envvar to have been set.
# - The 'TAG_NAME' is typically from the 'GITHUB_REF_NAME' variable
#   (https://docs.github.com/en/actions/learn-github-actions/variables)
#   from a GitHub Actions workflow run.

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
readonly DRY_RUN="$3"

TOP=$(cd $(dirname $0)/../ >/dev/null; pwd)
JSON=$TOP/node_modules/.bin/json

if [[ ! -f "$PKG_DIR/package.json" ]]; then
  fatal "invalid PKG_DIR arg: '$PKG_DIR/package.json' does not exist"
fi
if [[ -z $(git tag -l "${TAG_NAME}") ]]; then
  fatal "invalid TAG_NAME arg: '$TAG_NAME' git tag does not exist"
fi

PKG_NAME=$($JSON -f "$PKG_DIR/package.json" name)
PKG_VER=$($JSON -f "$PKG_DIR/package.json" version)
if [[ "v$PKG_VER" != "$TAG_NAME" ]]; then
  fatal "TAG_NAME, '$TAG_NAME', does not match version in package.json, '$PKG_VER'"
fi

# Extract the changelog section for this version.
$TOP/scripts/extract-release-notes.sh $PKG_DIR
echo "INFO: Extracted changelog"
echo "--"
cat build/release-notes.md
echo "--"

echo
echo "INFO: List current GitHub releases"
gh release list

# The latest (by semver version ordering) git version tag, excluding pre-releases.
# TODO: this assumes a tag "vN.M.O", which won't work for prefixed-tags.
LATEST_GIT_TAG=$(git tag --list --sort=version:refname "v*" | (grep -v - || true) | tail -n1)
if [[ -z "$LATEST_GIT_TAG" || "$TAG_NAME" == "$LATEST_GIT_TAG" ]]; then
  IS_LATEST=true
else
  IS_LATEST=false
fi

echo
echo "INFO: Creating '$PKG_NAME $TAG_NAME' GitHub release (latest=$IS_LATEST)"
if [ "${DRY_RUN}" == "false" ] ; then
  echo "RUN gh release create $TAG_NAME"
  exit 0
  gh release create "$TAG_NAME" \
    --title "$PKG_NAME $PKG_VER" \
    --notes-file build/release-notes.md \
    --latest=$IS_LATEST
else
  echo "DRY-RUN: gh release create $TAG_NAME"
fi
