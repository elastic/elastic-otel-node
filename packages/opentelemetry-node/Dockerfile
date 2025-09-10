# This builds a Docker image including the Elastic Distribution of OpenTelemetry
# for Node.js (EDOT Node.js). This is typically published as:
#
#   docker.elastic.co/observability/elastic-otel-node:<TAG>
#
# The image is effectively the `@elastic/opentelemetry-node` npm package, with
# its dependencies, and a "autoinstrumentation.js" driver, as required by the
# OpenTelemetry Operator.
#
# To build this image, do the equivalent of the following. The build context is
# the *top* of the repo, because some build scripts outside of the package
# dir are required:
#   cd packages/opentelemetry-node
#   docker build -t <name>:<tag> -f ./Dockerfile ../../
#
# Typically the build is handled by CI, which also adds other build tags,
# handles provenance, etc.

FROM node:24 AS build

WORKDIR /build/src
COPY ./packages/opentelemetry-node/ /build/src/packages/opentelemetry-node/
COPY ./scripts/ /build/src/scripts/

WORKDIR /build/pack
# Use 'npm pack' to get just the npm-published files.
RUN npm --loglevel=warn pack /build/src/packages/opentelemetry-node
RUN tar --strip-components=1 -xf elastic-opentelemetry-node-*.tgz
RUN rm elastic-opentelemetry-node-*.tgz
# Add the lock file, so we can 'npm ci'.
RUN cp /build/src/packages/opentelemetry-node/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
# Add license notice info for bundled dependencies.
RUN /build/src/scripts/gen-notice.sh . > ./NOTICE2.md \
    && mv NOTICE2.md NOTICE.md
RUN cp /build/src/packages/opentelemetry-node/autoinstrumentation.js ./

# The OpenTelemetry Operator support for Node.js instrumentation requires:
# 1. all files under "/autoinstrumentation",
# 2. a working `cp` in the image for copying that directory to a shared volume,
# 3. a "autoinstrumentation.js" in that dir (will be used with `--require ...`).
#
# See notes at: https://github.com/open-telemetry/opentelemetry-operator/blob/main/autoinstrumentation/nodejs/Dockerfile
FROM docker.elastic.co/wolfi/chainguard-base:latest@sha256:a58ef014ab5946b40bc6bbe5cb5f937d2bdaae3682af6861020c3941ba7a22b7
COPY --from=build /build/pack /autoinstrumentation
RUN chmod -R go+r /autoinstrumentation
