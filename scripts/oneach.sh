#!/bin/bash
#
# This script runs the the given argv in each package dir in this repo.
# Basically this is something of a replacement for `npm run --workspaces ...`
# since this repo no longer uses npm workspaces.
#
# Usage:
#   npm run oneach -- COMMAND [ARGS...]
#
# Examples:
#   npm run oneach -- npm ls
#

if [ "$TRACE" != "" ]; then
    export PS4='${BASH_SOURCE}:${LINENO}: ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
    set -o xtrace
fi
# Note: explicitly NOT setting errexit and pipefail so that we continue on error.

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
PKGDIRS=$(ls -d packages/* examples .)
CMD="$@"

finalRetval=0
for pkgDir in $PKGDIRS; do
    echo

    echo -e "\033[90m> $pkgDir\033[0m"
    (cd $pkgDir && $CMD)
    retval=$?
    if [[ $retval -ne 0 ]]; then
        echo -e "\033[31m> non-zero exit status in '$pkgDir': $retval\033[0m"
        finalRetval=1
    fi
done

exit $finalRetval
