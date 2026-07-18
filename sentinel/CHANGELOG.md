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

- **Witness ingests Cypress** — a second E2E framework on the execution axis
  ([ADR-0030](docs/adr/0030-witness-cypress-ingest.md), epic #49). `witness.mjs` gains a `--cypress` input
  that reads the **Cypress Module API result** (`CypressRunResult`, what `cypress.run()` resolves to) and maps
  it to the same `PASSED/WARNED/FAILED → ship-baseline/canary/hold` scale as Playwright. The gate generalises
  from a Playwright-only branch to an **execution axis** (`{playwright, cypress}`) taken **worst-wins across
  every suite present** — so `ship` now requires *every* E2E suite green (a green Playwright can't paper over a
  red Cypress). **Honest asymmetry, documented not hidden:** Playwright emits `stats.flaky`; Cypress emits no
  flaky count, so Witness **derives** the WARNED signal by scanning per-test `attempts[]` for a
  failed-then-passed retry (the pattern Cypress's own docs show) and labels the metric `flakyDerived`. The
  SKILL documents the tiny `cypress.run()` wrapper that produces the result file and **why** it's required over
  `cypress run --reporter json` (the mocha reporter has no `attempts`, so it would silently drop the flake).
  No schema-version bump — `stage` is a free string (contract Q1), the exact additive extension v0 was designed
  to absorb. Verified: 67/67 gate self-tests (Cypress derivation truth table, attempts-based flake incl. the
  ended-failed-is-not-a-flake guard, Cypress-only + both-frameworks worst-wins, fixture e2e) + real-CLI drive
  of the ship/hold/mixed paths. Schema-faithful fixtures + verified docs (native Cypress run is macOS-blocked,
  Docker-only — matching how Playwright ingest was validated).

- **`contract-guard`** skill (consumer-side contract check, issue #48 / spec #71): gives the *stranded*
  enterprise frontend team the coverage Pact structurally can't (Pact needs provider participation). Tiered,
  cheapest-first — **Tier 0** detect existing response validation (schema present → drift self-revealing,
  recommend nothing); **Tier 1** untyped frontend → propose/scaffold client-side response-schema validation
  (the lighter play); **Tier 2** empty-diff + no-validation → **differ** the shape the consumer expects against
  the provider's **published** OpenAPI/Swagger, carrying the deliberate-vs-accidental oracle (matches spec →
  deliberate/stale, offer update; contradicts / no spec → suspected break → `/bug-report`). Static-judgment
  only (ADR-0010) — reads the *published* contract, never snapshots a live response; human disposition only
  (ADR-0013), proposes never applies (ADR-0002/0003). Is the detector `/debug-test --drift` was scoped to
  consume (ADR-0018 → ADR-0021). User-invoked leaf (ADR-0020).

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
- **`e2e-impact`** skill (E2E test-impact-analysis v0, issue #44): maps a working/PR diff → the
  Playwright/Cypress specs it plausibly hits, via test-side-import, route, and selector/test-id
  signals (incl. project custom commands + substring matches), each with a confidence and an honest
  **run-all / unmapped** fallback — never silently dropping a changed file. Emits a source→spec
  relevance map that `/debug-test --drift` reads inverted (ADR-0018). Heuristic v0:
  correctness-with-honest-gaps over false precision. User-invoked leaf (ADR-0020).

### Changed

- **External-tool provenance pass** (issue #47 follow-up): six external tools the map named only as *Unexamined leads*
  were verified against their **primary sources** and promoted per ADR-0013. Now **advice (Proven)**: **TEA**
  (BMAD Test Architect — risk tables + governance gate; a *credibility-side ally*), **Playwright Planner/Generator**
  agents, **Cypress AI** (`cy.prompt()` surfaced **with its self-heal hazard caveat**), and **Exspec** (static
  test-quality linter — a cheap credibility pre-screen for `qa-review`/`coverage-review`). **coverage-guard** was
  verified but stays a **hazard-caveat lead, not advice** — it auto-generates tests looping to 100% line coverage
  (manufactured confidence, the exact slop `coverage-review`/`audit-test` counter). Updates the orchestration-map
  Evidence Ledger + the `ask-sentinel` wider-map table; corrects the map's earlier (wrong) claim that Exspec/coverage-guard
  had no owning source. TEA↔Sentinel/Witness integration seams captured in #96.
- **`ask-sentinel` gains a sequence mode** ([ADR-0027](docs/adr/0027-ask-sentinel-orchestrated-sequence-mode.md),
  issue #47 capstone slice): the whole-map router now has a second reading. A *single question* still returns **one**
  best tool (à la carte, ADR-0025); a *lifecycle / workflow ask* — "walk me through QA before I merge", "the full path
  to ship this safely" — now returns an **ordered stage path** (orchestrated): the best tool per relevant stage with its
  provenance label, the escalate-if condition between stages, closing on `/sentinel` at the Gate. The path is
  **entry-anchored** to where the change sits (before code → Plan; tests exist → Audit/Coverage; red → Triage) and
  **tailored** — only the stages that matter, never an untailored seven-stage dump — and it stays **à la carte** (run as
  few or as many as you need; a recommendation, not a mandate). Reuses ADR-0025's per-stage routing + labels; no new
  provenance machinery. Guarded by two routing-eval cases (`seq-before-code`, `seq-pre-merge` — the latter asserts
  entry-anchoring: a pre-merge path must not start at `/test-plan`). Delivers the "tool **and** stage order" half of #47;
  the map's "orchestrated" mode is now executable.
- **`ask-sentinel` becomes the whole-map router** ([ADR-0025](docs/adr/0025-ask-sentinel-stack-aware-router-reads-manifests.md),
  issue #47 first slice): it now routes to the best QA-AI tool for a situation — **external tools *and* Sentinel's own
  skills**, not just the twelve Sentinel skills — resolving open question #2 of the orchestration map (the map graduates
  from notes to a runnable front door, and is now **committed as the tracked evidence ledger** at
  `docs/orchestration-map.md` — previously gitignored local notes). It is **stack-aware**: it may read build/config *manifests* (`package.json`,
  `playwright.config.*`/`cypress.config.*`, a published OpenAPI/Swagger) to pick external-best vs Sentinel-gap-filler per
  stage, while still never reading test/source *logic*, running a test, or emitting a verdict (contract refined, not
  broken). Every route **carries its provenance label** (ADR-0013): Proven/Likely is advice, **Unexamined is a *lead*, not
  advice**, and self-healers are surfaced only with their heal-to-green caveat. Wires in the three previously-orphaned
  app-driven skills (`e2e-impact`, `audit-orchestrator`, `contract-guard`), retiring the "reach these three directly for
  now" disclaimer. **Deferred** to later slices: emitting an ordered stage sequence, and a research pass to upgrade the
  Unexamined external tools (TEA, Exspec, Planner/Generator agents, coverage-guard) from lead to labelled advice. The
  matching `#74` routing-eval cases are a coordinated follow-up (left untouched here to avoid colliding with that effort).
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
