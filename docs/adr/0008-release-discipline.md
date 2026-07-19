# Sentinel releases are a version bump landing on the default branch, tracked by a changelog and a shell script

Sentinel is distributed as a plugin through a marketplace manifest, not as an npm
package. It still needs enough release discipline to answer "what changed, and at
which version?" without inventing an npm-shaped release pipeline it does not use.
Option B is the lightweight answer: a per-plugin semantic `version`, a
Keep-a-Changelog `CHANGELOG.md`, and a small shell script that performs the bump.

The pieces:

- The authoritative version is the `version` field in
  `.claude-plugin/plugin.json` — the single source of truth. The
  marketplace entry in the root `.claude-plugin/marketplace.json` deliberately does
  not duplicate it (see ADR 0006).
- `CHANGELOG.md` follows Keep a Changelog. Every PR appends its user-facing
  change under `## [Unreleased]`; that is the contribution convention documented in
  `CONTRIBUTING.md`.
- `scripts/release.sh <version>` cuts a release in one command: it moves the
  `## [Unreleased]` entries under a new dated `## [X.Y.Z] - YYYY-MM-DD` heading and
  bumps `version` in `plugin.json`, leaving a fresh empty `## [Unreleased]` behind.

## Why lightweight, not Changesets

A QA plugin that ships through a marketplace does not have an artifact to publish to a
registry, so the machinery that a registry demands would be pure overhead here.
Explicitly out of scope: no Changesets, no `package.json`, no `npm publish`, no build
step, and no automated git tagging inside the script. "Release" means exactly one
thing — the version bump landing on the default branch — after which users consume the
new version by updating the marketplace. Keeping the tooling to a readable shell script
and a hand-edited changelog matches ADR 0005's rule: raise the quality *bar* of a
maintained plugin (a real changelog and semver) without adopting the *scope* of a
package-publishing pipeline the tool never uses.

## Consequences

- Contributors must add a changelog entry under `## [Unreleased]` in the same PR as
  their change; a PR that changes behavior without a changelog line is incomplete.
- Version bumps are intentional and human-initiated: a maintainer runs
  `release.sh <version>`, reviews the diff, and commits it. The script never commits,
  tags, or pushes on its own.
- Semver is chosen by hand per the nature of the change (breaking / feature / fix),
  since there is no Changesets metadata to infer it from.
- There is no published package to consume; downstream users get the new version
  through a marketplace update, so the default branch is the release surface.
