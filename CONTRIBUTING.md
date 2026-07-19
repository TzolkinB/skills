# Contributing / Getting Feedback

This is a personal framework first, but it's more useful — and more credible — with real input from people who do QA professionally.

## If you're a seasoned QA professional reviewing this

Specific questions that are actually useful (generic "what do you think?" isn't):

- Does this orchestration approach match how you'd structure testing on a real project?
- What's missing from a real testing perspective — not a beginner's checklist, but something you'd expect to see and don't?
- Would you use this on a project? Why or why not?
- Where would this break — what kind of codebase or team would make this fall apart?

## Logging feedback

Feedback lives in the open, in the homes that already exist — not a separate log to drift:

- **File an issue** with the observation. That is the durable, public record that the tool was reviewed rather than built in isolation.
- **If it changes behavior**, the fix lands with a `CHANGELOG.md` entry under `## [Unreleased]` (see below).
- **If it changes a decision or a tradeoff**, record it — or amend the one it affects — as an ADR under [`docs/adr/`](./docs/adr/). That's where the *why* is kept.

Don't write up feedback that hasn't happened yet. An empty issue tracker is more credible than a fabricated log.

## If you want to contribute code/skills

1. Try the skills on your own code first
2. Open an issue describing the gap you hit
3. PRs welcome, especially ones that come with a real example of what broke without the fix

## Changelog: append to `## [Unreleased]` in your PR

Sentinel keeps a per-plugin changelog at [`CHANGELOG.md`](./CHANGELOG.md) in
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Any PR that changes
user-facing behavior must add a bullet under the `## [Unreleased]` section, using the
appropriate `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security`
subheading. Do not invent a version number or a date — that happens at release time.

Releases are lightweight (see
[`docs/adr/0008-release-discipline.md`](./docs/adr/0008-release-discipline.md)): the
authoritative version is the `version` field in `.claude-plugin/plugin.json`, and a
maintainer cuts a release with:

```
scripts/release.sh <new-version>   # e.g. scripts/release.sh 0.2.0
```

That moves the `## [Unreleased]` entries under a new dated version heading and bumps
`plugin.json`. There is no npm publish — a "release" is just that version bump landing
on the default branch, consumed via a marketplace update.

## Required checks

Every pull request must pass the **`validate`** GitHub Actions workflow before it
can merge. It runs `claude plugin validate` across the repo — the root
marketplace manifest plus each plugin — and fails on any invalid manifest or
malformed skill/agent/command frontmatter. Run it locally before pushing:

```
claude plugin validate .          # marketplace manifest
claude plugin validate ./sentinel # a plugin (manifest + skill frontmatter)
```
