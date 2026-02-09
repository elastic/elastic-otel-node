#!/bin/bash
#
# Check if an install of @elastic/opentelemetry-node results in installing
# duplicates of packages. We want to avoid that. This can happen fairly
# easily with the many '@opentelemetry/*' packages.
#
# Note: This currently uses a tool from trentm/npm-tools that *isn't*
# installed locally. If we want to use this script in CI or regularly,
# we should install 'npm-ls-dupes' in this repo.

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

TOP=$(cd $(dirname $0)/../ >/dev/null; pwd)

BUILD_DIR="$TOP/build/check-install-dupes"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
npm pack --pack-destination="$BUILD_DIR"

echo
cd "$BUILD_DIR"
echo '{}' >package.json
npm install ./elastic-opentelemetry-node-*.tgz

echo
npm-ls-dupes -E # from github.com/trentm/npm-tools
