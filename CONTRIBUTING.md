# Contributing / Getting Feedback

This is a personal framework, first. It becomes more useful, and more credible, with real input from people who work in QA professionally.

## If a QA Professional Reviews This

These specific questions are useful. A general question like "What do you think?" is not:

- Does this orchestration approach match the way you structure testing on a real project?
- From a real testing perspective, what is missing? Not a beginner's checklist — something you expect to see, but do not.
- Is this tool useful on a project of yours? Explain why, or why not.
- Where does this break? What kind of codebase or team causes this framework to fail?

## Logging Feedback

Feedback lives in the open, in the places that already exist for it — not in a separate log that falls out of date:

- **File an issue** with the observation. That is the durable, public record that someone reviewed the tool, instead of building it in isolation.
- **If a fix changes behavior**, add a `CHANGELOG.md` entry under `## [Unreleased]` (see below).
- **If a change affects a decision or a tradeoff**, record it as an ADR under [`docs/adr/`](./docs/adr/), or amend the ADR it affects. This is where the project keeps the *why*.

Do not write up feedback before it happens. An empty issue tracker is more credible than a fabricated log.

## To Contribute Code or Skills

1. Try the skills on your own code first.
2. Open an issue. Describe the gap you found.
3. We welcome PRs, especially a PR that comes with a real example of what broke without the fix.

## Changelog: Add an Entry Under `## [Unreleased]`

This plugin keeps a changelog at [`CHANGELOG.md`](./CHANGELOG.md), in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. If a PR changes user-facing behavior, it must add a bullet under the `## [Unreleased]` section. Use the correct subheading: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security`. Do not invent a version number or a date. A maintainer adds these at release time.

Releases are lightweight (see
[`docs/adr/0008-release-discipline.md`](./docs/adr/0008-release-discipline.md)). The
authoritative version is the `version` field in `.claude-plugin/plugin.json`. A
maintainer cuts a release with this command:

```
scripts/release.sh <new-version>   # e.g. scripts/release.sh 0.2.0
```

This command moves the `## [Unreleased]` entries under a new dated version heading,
and bumps `plugin.json`. There is no npm publish. A "release" is that version bump
landing on the default branch. Users consume it through a marketplace update.

## Required Checks

Every pull request must pass the **`validate`** GitHub Actions workflow before
merge. This workflow runs `claude plugin validate` across the repo: the root
marketplace manifest, plus each plugin. It fails on an invalid manifest, or on
malformed skill, agent, or command frontmatter. Run it locally before you push:

```
claude plugin validate .          # marketplace manifest + the plugin (manifest + skill frontmatter)
```
