# Contributing to the Elastic Distribution for OpenTelemetry Node.js

This distribution is open source and we love to receive contributions.
There are many ways to contribute: submitting bug reports and feature requests,
submitting pull requests for issues, improving documentation, interacting on
our discussion forum, etc.

You can get in touch with us through [Discuss](https://discuss.elastic.co/tags/c/apm/nodejs),
feedback and ideas are always welcome.


## Code contributions

If you have a bugfix or new feature that you would like to contribute, please do the following:
- Double check in open issues if there are any related issues or PRs.
- Consider whether the changes can best be added to upstream https://github/open-telemetry repositories. (Please ask if unsure!)
- Open an issue, ensure that you have properly described the use-case and possible solutions, link related issues/PRs if any.
- Open a PR and link the issue created in previous step with your code changes.

Doing so allows to:
- share knowledge and document a bug/missing feature;
- get feedback if someone is already working on it or is having a similar issue; and
- benefit from the team experience by discussing it first. There are lots of implementation details that might not be
obvious at first sight.


## Linting

Ensure your code contribution pass our linting (style and static checking):

```
npm run ci-all
npm run lint
```

Often style checking issues can be automatically resolve by running:

```
npm run lint:fix
```


## Testing

tl;dr:

```shell
npm run ci-all   # runs 'npm ci' in all package dirs; see note 1
cd packages/opentelemetry-node
npm run test-services:start  # requires Docker
npm test
npm run test-services:stop
```

See [TESTING.md](./TESTING.md) for full details.

> *Note 1*: While this repo holds multiple packages, it is *not* using npm workspaces. This means that one must `npm ci` (or `npm install`) in each package directory separately. See [this issue](https://github.com/elastic/elastic-otel-node/pull/279) for why npm workspaces are not being used.


## Commit message guidelines

This repo *loosely* encourages commit messages per [Conventional
Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary). It is helpful
if the *first* commit for a pull-request follows this format. Follow-up
commits on a feature branch do not need to conform to this format.

```
<type>(<optional scope>): <description>

[Optional body paragraphs.]

[Optional footers, e.g. "Fixes: #123" or "Co-authored-by: ...".]
```

1. The first line should contain **a short description of the change.**

   It may optionally be prefixed with a *type*:
    * "fix:" when fixing a bug
    * "feat:" when adding a new feature
    * "docs:" when only updating documentation
    * "refactor:" when refactoring code without changing functional behavior
    * "test:" when only updating tests
    * "perf:" when improving performance without changing functional behavior
    * "chore:" when making some other task that does not change functional behavior

    The "optional scope" is commonly a package name, e.g.: `fix(opentelemetry-node): ...`.

    Append a `!` if the change is a breaking change, e.g.: `fix!: re-write config system`.

2. The second line MUST be blank.

3. Optionally provide body paragraphs that **explain the what and why of the change,** and not the how.
   Wrap all lines at 72 columns, within reason (URLs, quoted output).

   If your commit introduces a breaking change, it should clearly explain the
   reason for the change, which situations would trigger the breaking change,
   and what is the exact change.

5. If fixing an open issue, add a footer block of the form `Fixes: #123` or
   `Closes: #123`. If the change is strongly related to another issue, PR,
   discussion, or some link, add a `Refs: ...` footer.

Of these guidelines, the bolded parts are the most important: A succinct
description and a body that answers "what" and "why" will best help future
maintainers of the software.

An example:

```
feat: initial ESM support

This adds initial and ECMAScript Module (ESM) support, i.e. `import ...`,
via the `--experimental-loader=elastic-apm-node/loader.mjs` node option.
This instruments a subset of modules -- more will follow in subsequent changes.

Other changes:
- Fixes a fastify instrumentation issue where the exported `fastify.errorCodes`
  was broken by instrumentation (both CJS and ESM).
- Adds a `runTestFixtures` utility that should be useful for running out of
  process instrumentation/agent tests.

Closes: #1952
Refs: #2343
```


## CHANGELOG.md guidelines

The audience for commit messages is maintainers of the software.
The *audience for the changelog is users of the software*.
Often this means that the changelog should *not* just repeat the commit message summary.

If your changes will impact the user of this distro, then describe how in
the changelog. It is okay to use more space than a single line, to show
example code and output. However, if the description is getting *very* long,
then likely updated documentation is worthwhile.

