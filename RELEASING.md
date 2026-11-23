# How to release packages in this repo

This repository holds multiple npm packages (though npm workspaces are not
being used). Currently each package releases independently -- i.e. their
versioning is not tied to each other. A release of a package consists of (a) a
repo git tag at the appropriate commit and (b) one or more release artifacts
(typically a release published to npmjs.com).

By far the primary package in this repo is [`@elastic/opentelemetry-node`](./packages/opentelemetry-node/).
The tag name for a release of the primary package will not use a prefix; other
packages will use a prefix (the basename of the npm package name). For example,

| Package                       | Tag Pattern            | Examples |
| ----------------------------- | ---------------------- | -------- |
| `@elastic/opentelemetry-node` | `v*`                   | v2.3.4   |
| `@elastic/mockotlpserver`     | `mockotlpserver-v*`    | mockotlpserver-v0.2.0 |
| `@elastic/mockopampserver`    | `mockopampserver-v*`   | mockopampserver-v0.4.0 |
| `@elastic/opamp-client-node`  | `opamp-client-node-v*` | opamp-client-node-v0.3.0 |

## How to release `@elastic/opentelemetry-node@latest`

(For a **maintenance** release of the previous major, see the section below.)

Assuming "x.y.z" is the release verison:

1. Choose the appropriate version number according to semver.

2. Create a PR with these changes:
    - Bump the "version" in "packages/opentelemetry-node/package.json".
    - Run `npm install` in "packages/opentelemetry-node/" to update "packages/opentelemetry-node/package-lock.json".
    - Update release notes in "docs/release-notes/\*" as necessary.
    - Name the PR something like "release @elastic/opentelemetry-node@x.y.z" (The PR title is not strict.).

3. Get the PR approved and merged.

4. Working on the elastic repo (not a fork), tag the commit as follows:
    ```
    git tag vx.y.z
    git push origin vx.y.z
    ```
    The GitHub Actions "release" workflow will handle the release
    steps -- including the `npm publish`. See the appropriate run at:
    https://github.com/elastic/elastic-otel-node/actions/workflows/release.yml

5. If this is a **new major**, then ensure that the version is updated at <https://www.elastic.co/support/eol#current-versions>.

6. Watch for <https://github.com/elastic/elastic-agent/actions/workflows/bump-edot-images.yml>
   to create a PR to bump the Elastic Agent to the latest version. It runs once per
   day. [Example PR.](https://github.com/elastic/elastic-agent/pull/17935).

## How to release maintenance `@elastic/opentelemetry-node@1.x`

Approximately Nov 2026, a v2.x version of `@elastic/opentelemetry-node` was
released. The `v1.x` line will be maintained for 18 months. Generally only
serious bug fixes and security fixes will be considered. Maintenance is
on the `v1.x` branch.

Assuming `1.20.z` is the release version:

1. Choose the appropriate version number according to semver.

2. Create a PR with these changes:
    - Bump the "version" in "packages/opentelemetry-node/package.json".
    - Run `npm install` in "packages/opentelemetry-node/" to update "packages/opentelemetry-node/package-lock.json".
    - Update release notes in "docs/release-notes/\*" as necessary.
    - Name the PR something like "release @elastic/opentelemetry-node@1.20.z". (The PR title is not strict.)

3. Get the PR approved and merged.

4. Working on the elastic repo (not a fork), tag the commit as follows:
    ```
    git tag v1.20.z
    git push origin v1.20.z
    ```
    The GitHub Actions "release" workflow will handle the release
    steps -- including the `npm publish`. See the appropriate run at:
    https://github.com/elastic/elastic-otel-node/actions/workflows/release.yml

## How to release other packages

Assuming:
- **VERSION="x.y.z"** is the release version and
- **PKGSUBDIR="opamp-client-node"** is the package being released.
  (Note that the PKGSUBDIR, the directory under "packages/" is *not necessarily*
  the basename of the npm package.)

1. Choose the appropriate version number according to semver.

2. Create a PR with these changes:

    - Bump the "version" in "packages/$PKGSUBDIR/package.json".
    - Run `npm install` in "packages/$PKGSUBDIR/" to update "packages/$PKGSUBDIR/package-lock.json".
    - Update "packages/$PKGSUBDIR/CHANGELOG.md" as necessary.
    - Name the PR something like "release $PKGSUBDIR x.y.z". (The PR title is not strict.)

3. Get the PR approved and merged.

4. Working on the elastic repo (not a fork), tag the commit as follows:

    ```
    git tag $PKGSUBDIR-vx.y.z
    git push origin $PKGSUBDIR-vx.y.z
    ```

    The GitHub Actions "release-$PKGSUBDIR" workflow will handle the release
    steps -- including the `npm publish`. See the appropriate run at:
    https://github.com/elastic/elastic-otel-node/actions
