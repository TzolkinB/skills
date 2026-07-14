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

### Added

- **`audit-orchestrator`** skill (stage-3 Audit router, issue #43): detects a suspicious passing test's stack
  (Playwright/Cypress app-driven vs Vitest/Jest unit) and routes it — unit JS/TS → Tautest (PR diff-mutation) /
  StrykerJS (full) where they fit; app-driven → `/audit-test` (dev-served) with the ADR-0016/0019 reachability
  guard, because source-mutating tools can't reach app-driven code (the reachability wall). Emits a
  provenance-labelled verdict (ADR-0013), never a gate. Proves the "orchestrate the best free tools + fill the
  E2E gap" pattern end-to-end. User-invoked leaf (ADR-0020).

- `debug-test` flake mode now routes **root-cause runtime evidence by framework** (new step F3):
  Playwright → trace viewer / Test Replay; Cypress → [`cypress-flaky-test-audit`](https://github.com/sclavijosuero/cypress-flaky-test-audit)
  (command-queue enqueue-vs-execution order, timing, never-run commands, retry diff), with a one-line
  "how to read it for a flake". Evidence *downstream of detection* — a pointer, not rebuilt
  instrumentation. (issue #46)

### Changed

- **Suite trigger model** ([ADR-0020](docs/adr/0020-suite-trigger-model-leaves-user-invoked.md)): the eight leaf skills
  (`audit-test`, `coverage-review`, `debug-test`, `prune-tests`, `qa-review`, `threat-model`, `test-plan`, `bug-report`)
  are now **user-invoked** (`disable-model-invocation: true`); discovery routes through the two model-invoked entry
  points, `ask-sentinel` and `sentinel`. Always-on descriptions drop from 10 to 2. Skills stay independently invocable
  and orchestration is unchanged (the router/`sentinel`/`debug-test` invoke leaves by name). Applies Matt Pocock's
  *writing-great-skills* trigger axis.
- **`debug-test` and `audit-test` restructured** for progressive disclosure (*writing-great-skills* structure axis):
  branch-only material moved into `reference/*.md` behind context pointers, loaded only when its trigger fires —
  `debug-test` Flake/Drift modes; `audit-test` Reachability check, Baseline-lock check, Batch mode, run-one-test.
  Behavior unchanged; the always-loaded `SKILL.md` shrinks ~63% (debug-test) / ~46% (audit-test).
- `audit-test` reachability guard now covers **warm dev-server mutation propagation**, not just stale
  builds (ADR-0019). On a dev-served app-driven target it forces the mutation live — a fresh-boot-per-run
  harness (e.g. Cypress `cypress/included`, or a built/CI server) or a dev-server restart — before
  trusting a *survival* as 🔴, closing a false-🔴 (and flaky-🟡) window where an HMR edit hadn't
  propagated to every assertion in a run. A `sleep`/settle doesn't fix it. (issue #54)

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
