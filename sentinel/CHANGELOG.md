# Changelog

All notable changes to the Sentinel plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versioning is per-plugin. The authoritative version lives in
`sentinel/.claude-plugin/plugin.json`; this changelog records what changed at each
version. A "release" is the version bump landing on the default branch, consumed by
users via a marketplace update — there is no separate publish step.

PRs append their change under `## [Unreleased]`, using the appropriate `Added` /
`Changed` / `Deprecated` / `Removed` / `Fixed` / `Security` subheading (see
`CONTRIBUTING.md`). `scripts/release.sh <version>` promotes those entries to a dated
release heading.

## [Unreleased]

## [0.2.0] - 2026-07-13

### Added

- `audit-test` **reachability guard** (ADR-0016): before recording a 🔴, it proves the harness is
  source-live via a maximal probe mutation. An app-driven Playwright/Cypress test that drives a stale
  build (`build && preview`, a served `dist/`) or a deployed URL now returns an honest 🟡 (the
  mutation never reached the running app) instead of a fabricated 🔴.
- `audit-test` **baseline-lock** ⚠️ suspicion flag (ADR-0017): catches the mirror failure a mutation
  can't see — a *live* assertion pinned to a regressed value (the fingerprint an AI self-healer leaves
  when it "fixes" a red test by rewriting the expected value). Reads as caution, never a pass.
- `audit-test` / `debug-test`: guidance for when the **Cypress runner won't launch** (macOS 26 /
  Electron 36 incompatibility) — framed as an environment reachability failure (honest "can't execute
  here", not a fabricated verdict), with the Docker (`cypress/included`) / CI-Linux remedy.
- `audit-test`: Playwright & Cypress added to the run-one-test guidance (single-test isolation via
  `--project` / `@cypress/grep`).
- `debug-test` **drift mode**: classifies an already-red test as external drift vs local regression
  from static signals (diff-relevance → temporal → published-contract), quarantines it non-blocking,
  and surfaces the mismatch for a human to dispose — never healing to green or unilaterally blaming
  the provider. Entered via `--drift` or a deterministic red whose diff doesn't touch the code the
  test exercises. Sibling of flake mode; backed by a blinded n=1 existence proof (ADR-0018,
  EXPERIMENT-0018, issue #42).
- Per-skill human-facing docs tree under `docs/`: one page per skill (what it does, when to use /
  when not, a worked example against the fixtures, anti-patterns), plus a skill-index table in
  `README.md` linking each skill to its doc page and its `SKILL.md`. Docs sit at a distinct altitude
  from `SKILL.md` — they describe why/when, not how the agent executes (issue #10).
- `ask-sentinel` router skill: a front-door that maps a QA situation to the right one of the
  nine skills and describes the intended flow, naming `/sentinel` as the orchestrator. It is a
  router, not one of the nine, and never joins the `/sentinel` chain (issue #8).
- Release discipline: `CHANGELOG.md`, a per-plugin semver source of truth, and a
  `scripts/release.sh` release script (ADR 0008).
- ADR 0009: `coverage-review` consumes line-coverage as evidence, it does not produce it —
  positions `test-coverage-analyzer` / NYC / JaCoCo as a route into `coverage-review`, not a
  rival, mirroring the Stryker seam in ADR 0004.
- ADR 0010: scope decision for the market analysis's two open gaps — live-execution stays out
  (delegated across `debug-test`'s healer / `diagnosing-bugs` routing seam), temporal memory is
  in-scope-by-philosophy but deferred behind a defined seam.

## [0.1.0] - 2026-07-09

### Added

- Initial Sentinel plugin: QA-first testing skills for Claude Code.
