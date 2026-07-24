# Changelog

All notable changes to the kimbell-skills plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versioning is per-plugin. The authoritative version lives in
`.claude-plugin/plugin.json`; this changelog records what changed at each
version. A "release" is the version bump landing on the default branch, consumed by
users via a marketplace update — there is no separate publish step.

PRs append their change under `## [Unreleased]`, using the appropriate `Added` /
`Changed` / `Deprecated` / `Removed` / `Fixed` / `Security` subheading (see
`CONTRIBUTING.md`). `scripts/release.sh <version>` promotes those entries to a dated
release heading.

## [Unreleased]

### Fixed

- **`gate.mjs --verify` now shape-validates the bundle before trusting the signature, and reports the
  narrow scope it actually vouches for** (post-#141 signature-verification hardening). Two gaps in the DSSE
  verify path, both fail-*closed* (neither could forge a decision): (1) `--verify` called `verifyGateBundle`
  without first running `validateBundle`, and `verifyGateBundle` binds to the *first* gate entry it finds —
  so a structurally-invalid bundle (e.g. a duplicate gate entry) could print "✓ signature valid" despite
  violating the contract. `--verify` now runs `validateBundle` first and refuses to vouch for a malformed
  bundle. (2) The signature deliberately covers only the gate Statement (the decision + the content-addressed
  input digests), never `producedOn`/`schemaVersion`/the ingested evidence entries ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md)
  §1) — but a bare "✓ valid" invited reading it as "the whole file is authentic." `verifyGateBundle` now
  returns an `attested` object (the decision + subject names), the `--verify` message states that scope
  explicitly, and `skills/gate/SKILL.md` spells out what is inside vs. outside the signature. Self-test gains
  rows for the attested-scope report and the duplicate-gate shape guard.

- **`evals/changed.mjs`: `REPO_ROOT` resolved one directory too high, so the change-detection gate ran
  every git call outside the repo and always silently reported zero affected skills** (closes #148, found
  while implementing #140). `REPO_ROOT` was a hand-rolled `resolve(EVALS_ROOT, '../..')` — one `..` too
  many now that `evals/` sits directly under the repo root (likely a leftover from before
  [ADR-0032](docs/adr/0032-flatten-to-single-kimbell-skills-plugin.md)'s flatten). Every `git` call ran
  with that wrong `cwd`, failed (not a git repo), and was silently swallowed by a `status !== 0` fallback
  written for a different, legitimately-benign case (an unfetched base ref) — so `changedFiles()` was
  always empty and `node evals/changed.mjs` always printed "nothing to run," confirmed both locally and on
  a real PR's `--gate` CI run. Fixed three ways: (1) `REPO_ROOT` now resolves via
  `git rev-parse --show-toplevel` (run with `cwd=EVALS_ROOT`, which is always inside the repo regardless
  of nesting depth) instead of a hardcoded relative path; (2) the shared `git()` helper is split into
  `gitStrict()` (throws on any unexpected failure) and `gitAllowMissingRef()` (the one call — the
  committed-diff leg against a possibly-unfetched `baseRef` — where a failure is genuinely expected and
  benign), so a real error can no longer be conflated with and swallowed as the benign case; (3)
  `--self-test` gains a real git-integration check (`REPO_ROOT` contains `.git` and `evals/changed.mjs`;
  a trivial `changedFiles('HEAD')` call must not throw) alongside the existing pure-classifier check —
  the previous self-test only ever fed a synthetic file list, so it structurally could not have caught
  this. Verified: `node evals/changed.mjs --self-test` green (mapping, harness-core fan-out, repo-root,
  git-integration all `true`); `node evals/changed.mjs --base=<a pre-#140 commit>` now correctly reports
  `audit-test` as affected and runs its self-test + lint, where it previously reported zero affected
  skills for the same diff.

### Changed

- **Gate docs honesty pass — build-coupled wording for DSSE signing**
  ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md) Decision 4, capability A, part of #141). Docs-only,
  committed separately from the signing capability's code (same PR, separate commit, per ADR-0037's rule that
  build-coupled wording must not land before its capability). `skills/gate/SKILL.md` now says a bundle is a
  "DSSE-signed in-toto attestation" **only** when a signing key was supplied — the unsigned default keeps
  saying "in-toto-shaped, not a signed attestation," ADR-0032's hedge, verbatim. Adds a "sign the bundle" usage
  block (`--gen-key`/`--sign-key`/`--verify`), a Notes bullet on the self-signed scope (proves integrity +
  continuity, never third-party identity — explicitly not Sigstore, never "verified identity" or "trusted
  publisher"), and a `signed:`/`unsigned:` line in both Output Format examples. `README.md`'s `/gate` bullet
  gets one added sentence noting the optional signing. Addresses finding 5 of
  [`references/critique2-chatgpt.md`](references/critique2-chatgpt.md).

- **Gate docs honesty pass — build-independent wording batch**
  ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md) Decision 4, closes #138). Docs-only, no code or schema
  changes: `skills/gate/SKILL.md` and `README.md` now spell out the worst-wins rule in plain English (any
  `hold` → `hold`; else any `canary` → `canary`; else `ship`), state plainly that the Gate is advisory only —
  it does not abort the build and a `hold`/`canary` does not by itself stop a deployment — and scope the
  "deterministic" claim to the gate *decision* step, not the upstream Playwright/Cypress/`audit-test`
  evidence-gathering that fills the bundle. `skills/gate/SKILL.md` also gets a naming note recording that
  pre-rename ADRs say "Witness" by design ([ADR-0032](docs/adr/0032-flatten-to-single-kimbell-skills-plugin.md)) and
  are not being rewritten. `README.md`'s Contributing & Support section now opens with an explicit
  **Status: prototype** line. Addresses findings 3, 7, 8, 9, 10 of
  [`references/critique2-chatgpt.md`](references/critique2-chatgpt.md).

- **`ask-sentinel`/`audit-orchestrator` routing-evidence label: `Proven` → `Confirmed`**
  ([ADR-0036](docs/adr/0036-ask-sentinel-audit-orchestrator-confirmed-rename.md), closes #131). The residual
  scope ADR-0034/#126 deliberately deferred: these two skills apply the same `Proven`/`Likely`/`Unexamined`
  ternary ([ADR-0013](docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)) to grade a *routing
  recommendation*'s evidence, not `audit-test`'s per-test mutation verdict — but the same headline-word risk
  applied, and leaving it unrenamed after #126 shipped would have been a fresh inconsistency (schema says
  `confirmed`, the skills routing to/from it still said `proven`). Same word swap, same scope discipline as
  ADR-0034 (ordinary-verb "proven"/"provenance" untouched): `skills/ask-sentinel/SKILL.md`,
  `skills/audit-orchestrator/SKILL.md`, `docs/orchestration-map.md` (plus one stray lowercase
  `audit-test proven/likely/unexamined labels` mention on the same page — the #126 axis, found while sweeping
  this one), `evals/cases/audit-orchestrator.json`, the affected `evals/samples/ask-sentinel.*` /
  `evals/samples/audit-orchestrator.*` samples, and `fixtures/audit-orchestrator/expected-findings.md` (the
  rubric backing the touched eval case). No schema-version bump — prose/eval-fixture only, no JSON field.
  Historical ADRs, CHANGELOG, and the locked `references/witness-ingestible-evidence-audit.md` contract audit
  stay untouched (ADR-0034 §5 precedent). Verified: both skills' `run-eval.mjs --self-test` green
  (pass-samples pass, negative-samples still correctly fail), `evals/lint.mjs` clean on both `SKILL.md`
  files, `evals/lint.mjs`/`evals/changed.mjs` self-tests green, repo-wide grep confirms no remaining
  routing-evidence `Proven` mentions outside the excluded historical set.

### Added

- **Gate: cross-check the `audit-test` tally against its run trace**
  ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md) §3, capability B2, closes #142). `gate.mjs` now parses
  the optional `runs[]` per-test run trace a `gate-audit-test/v0.3` emission may carry (added by #140) and
  cross-checks it against the tally it rides alongside: `confirmedSolid` must equal the count of `killed`
  records, `confirmedHollow` the count of `survived` records, and `runs.length` must never exceed
  `deepAudited`. A tally that disagrees with its own trace — or a malformed run record — is rejected the
  same way an arithmetically-impossible tally is today: the whole emission degrades to the opaque report or
  absence, never a silent upgrade. An emission with no `runs[]` is unaffected (purely additive). When a trace
  passes the cross-check, its record count surfaces as a `runsVerified` metric on the audit-test *evidence*
  entry — never on the gate predicate, so honesty guard #3 (no numeric field in the gate predicate) stays
  intact. Ship-eligibility is unchanged: this hardens the evidence behind a `confirmed` label, it does not
  open a new path to `ship`. `AUDIT_EMISSION_SCHEMA` moves to the already-published exact-match string
  `gate-audit-test/v0.3` (the old `v0.2` string is no longer accepted, per the existing exact-match-not-a-prefix
  rule — a bogus/stale version degrades the emission rather than being silently honored). No bundle
  `schemaVersion` bump: same entry shape, only the audit-test entry's own `metrics` array gains an optional
  item. New fixture `skills/gate/fixtures/audit-test.confirmed-with-runs.json`. Verified:
  golden self-test gains rows for a consistent trace, a killed-count mismatch, a survived-count mismatch, an
  over-count, a malformed run record, a non-array `runs`, the `runsVerified` metric appearing/not-appearing,
  the gate predicate staying number-free with it present, and an unchanged ship-eligibility check — all
  green. The docs commit softening the audit-test self-report caveat to state the new cross-check property
  lands separately (ADR-0037 Decision 4).

- **`audit-test`: optional per-test run trace (`runs[]`) in `--emit-json`**
  ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md) §3, capability B2 prefactor, closes #140). The
  `--emit-json` emission gains an optional `runs[]` array — one record per test a mutation was actually
  **executed** against: `test` (identifier), `mutation` (what changed), `command` (the exact single-test
  command run), `outcome` (`"killed"` | `"survived"`), and `exitCode`. Only the execution-confirmed subset
  gets a record — every 🟢 confirmed-solid and 🔴 confirmed-hollow verdict; 🟡 Likely (env not runnable) and
  ⚠️ Baseline-lock tests stay reasoned-only and carry no record, and Unexamined tests never had a mutation
  proposed at all. Docs-only/schema-only change: `audit-test` is model-driven prose with no execution code of
  its own, so this is `skills/audit-test/SKILL.md` instructing the run trace and
  `skills/gate/schema/audit-test-emission.v0.schema.json` shaping it — nothing here validates or cross-checks
  the trace yet (that's Gate's job, #142, the T5 follow-up). The emission schema takes an additive minor bump,
  `gate-audit-test/v0.2` → `v0.3` (`runs[]` optional; an emission with no `runs[]` is unchanged from v0.2 and
  still behaves exactly as today). Verified: the `audit-test` eval gains a case grading honest trace
  reporting — a faithful sample whose `runs[]` matches what the transcript says happened, and a negative
  sample that fabricates a record for a test that was never executed, which the eval must fail.

- **Gate: DSSE-sign the gate Statement — opt-in, self-signed ed25519**
  ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md) §1, capability A, closes #141). With a signing key,
  `gate.mjs` now emits a [DSSE](https://github.com/secure-systems-lab/dsse) envelope over the gate Statement —
  `payloadType` is the in-toto JSON media type, `payload` is base64 of `{_type, predicateType, subject,
  predicate}` reconstructed from the bundle's `subject[]` (pr-head + the #139 input digests) and the gate
  entry's `predicate`, and `signatures[].sig` is an ed25519 signature over the DSSE pre-authentication encoding
  (not the raw JSON) with `keyid` = sha256 of the public key. Pairing with #139 means the signature covers the
  content-addressed inputs, not just the decision. With no key, the bundle keeps the same unsigned *shape* it
  had before this capability (no new required field, `dsseEnvelope` simply absent) — signing is strictly
  additive and opt-in; only `schemaVersion` itself moves, the same additive-minor-bump treatment every prior
  Gate capability has gotten. New pure, exported primitives —
  `dsseSign`/`dsseVerify`/`keyidFromPublicKey`/`signGateBundle`/`verifyGateBundle` — take key material and
  bytes/objects as arguments and never touch the filesystem; key loading and generation live in the CLI wrapper
  only (`--sign-key=<path>` to sign, `--gen-key=<prefix>` to write a fresh PKCS8/SPKI PEM pair, `--verify
  --bundle=<path> --pubkey=<path>` to check an existing bundle). `verifyGateBundle` checks the envelope's
  signature AND that its signed payload still matches the bundle's current `subject`/gate `predicate` — so
  editing the decision or an input digest after signing while leaving a stale envelope in place is caught, not
  just a raw signature mismatch. Zero new dependency (`node:crypto`'s built-in ed25519). `schemaVersion` takes
  an additive minor bump, `gate-evidence-bundle/v0.4` → `v0.5` (the optional top-level `dsseEnvelope` — every
  existing field and an unsigned bundle's shape are unchanged). The terminal report now states a bundle's
  signed/unsigned status plainly. Verified: golden self-test gains keyid-derivation, sign→verify round-trip,
  wrong-key-fail, tampered-payload-fail, decision-tampered-after-signing-fail, and
  input-digest-tampered-after-signing-fail rows, plus an end-to-end check against a newly committed
  fixture (`skills/gate/fixtures/gate-bundle.signed.json` + its demo keypair, fixture-only — not a secret) —
  all offline, in-memory keys. Self-signed ed25519 proves integrity + continuity, never third-party identity —
  not Sigstore; the docs commit updating `SKILL.md`'s wording to say "signed"/"attestation" only for signed
  bundles lands separately (ADR-0037 Decision 4).

- **Gate: content-address the inputs — sha256 into the gate Statement subject**
  ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md) §2, capability B1, closes #139). Every ingested input
  file (the Playwright JSON, the Cypress JSON, the `audit-test` emission and/or report) is now sha256-digested
  and recorded as a subject of the gate Statement's `subject[]`, alongside the existing `pr-head` git-commit
  subject — swap or edit an input after the bundle is produced and its recorded digest no longer matches, so
  the decision is now cryptographically bound to the exact bytes it ingested, not a typed commit string.
  Digests are lowercase hex **strings** living in `subject`, never in the gate **predicate** — honesty guard #3
  (no numeric field in the gate predicate) is unaffected. `assembleBundle` gains an `inputs: [{name, bytes}]`
  parameter; the hashing (`sha256Hex`, `inputSubjects`) is pure, taking bytes as arguments — all file I/O stays
  in the CLI wrapper (`main()`), keeping the new behavior exercisable offline in the self-test. The terminal
  report gains an "Input digests" section so a reader can see the binding. `schemaVersion` takes an additive
  minor bump, `gate-evidence-bundle/v0.3` → `v0.4` (`resourceDescriptor`'s shape is unchanged, so an old bundle
  with only the `pr-head` subject still validates). Verified: golden self-test gains known-bytes→known-digest,
  one-subject-per-input, and swap-changes-digest rows (function-level and bundle-level); CLI smoke-tested —
  hashing a fixture reproduces its real `shasum -a 256`, and editing a Playwright report's bytes changes the
  recorded digest end to end.
- **Gate: coverage-aware ship gate — the examined-floor** ([ADR-0035](docs/adr/0035-gate-examined-floor.md),
  closes #127). A confirmed-clean `audit-test` verdict used to be enough to propose `ship` regardless of how
  small the deep-audited fraction was — the shipped fixture was `deepAudited:4, unexamined:8` (33% examined),
  disclosed in the rationale (#112) but not gated on, exactly the "1-of-500" gap a hostile review flagged as
  the sharpest unresolved finding. `gate()` now ALSO requires `deepAudited`/`audited` to clear an
  **examined-floor** — default 50%, overridable via `--examined-floor` but clamped (with a warning) to a 25%
  minimum, never silently honored below it. No new categorical rung: a confirmed-clean-but-below-floor result
  proposes `canary`, same as every other under-proven credibility state, with a rationale line naming the
  fraction, the floor, and #127. No schema-version bump (a `gate.mjs` runtime rule change, same precedent as
  ADR-0029's B→A graduation); the floor's numbers live only in rationale prose, never as a predicate field
  (honesty guard #3 unaffected). `fixtures/audit-test.confirmed.json` updated from 4-of-12 to 6-of-12 so the
  shipped fixture demonstrates a run that clears the new default floor. Verified: golden self-test gains the
  issue's own 33%-examined example (now `canary`, was `ship`), a 25%-override case, and a clamp-to-25% case;
  CLI smoke-tested end to end for ship / below-floor / override / clamp.
- **Gate ingests Cypress** — a second E2E framework on the execution axis
  ([ADR-0030](docs/adr/0030-witness-cypress-ingest.md), epic #49). `witness.mjs` gains a `--cypress` input
  that reads the **Cypress Module API result** (`CypressRunResult`, what `cypress.run()` resolves to) and maps
  it to the same `PASSED/WARNED/FAILED → ship-baseline/canary/hold` scale as Playwright. The gate generalises
  from a Playwright-only branch to an **execution axis** (`{playwright, cypress}`) taken **worst-wins across
  every suite present** — so `ship` now requires *every* E2E suite green (a green Playwright can't paper over a
  red Cypress). **Honest asymmetry, documented not hidden:** Playwright emits `stats.flaky`; Cypress emits no
  flaky count, so Gate **derives** the WARNED signal by scanning per-test `attempts[]` for a
  failed-then-passed retry (the pattern Cypress's own docs show) and labels the metric `flakyDerived`. The
  SKILL documents the tiny `cypress.run()` wrapper that produces the result file and **why** it's required over
  `cypress run --reporter json` (the mocha reporter has no `attempts`, so it would silently drop the flake).
  No schema-version bump — `stage` is a free string (contract Q1), the exact additive extension v0 was designed
  to absorb. Verified: 70/70 gate self-tests (Cypress derivation truth table, attempts-based flake incl. the
  ended-failed-is-not-a-flake guard, Cypress-only + both-frameworks worst-wins, fixture e2e) + real-CLI drive
  of the ship/hold/mixed paths. Schema-faithful fixtures + verified docs, now backed by a **Docker ground-truth
  run** (`cypress/included`, 2026-07-18): a real `cypress.run()` over a pass / hard-fail / retried-then-passed spec
  confirmed the live `CypressRunResult` matches every fixture assumption — no aggregate flaky count anywhere, the
  flake surviving only in `attempts[]`, and `witness.mjs` deriving correctly against it (native Cypress run is
  macOS-blocked, Docker-only — matching how Playwright ingest was validated; see ADR-0030 follow-up).

- **`gate` eval — Cypress false-green case** (follow-up to ADR-0030, harness #74). A third `gate` eval case
  (`cypress-flaky-derived`) grades the Cypress-specific honesty surface the arithmetic self-test can't: on a
  Cypress run that reads **12/12 in `totalPassed`** but hides a retried-then-passed flake, the skill must present
  the **derived** `canary` (WARNED from `attempts[]`, not a Cypress field) and must **not** launder
  `totalPassed:12` into a clean-green `ship`. Faithful + hollow samples; offline self-test discriminates (the CI
  gate), keeping the Cypress reporting path trust-gated like the Playwright cases.

- **Positioning note: "Why not *just* TEA?"** ([`docs/comparisons/tea.md`](docs/comparisons/tea.md),
  issue #96 Part B). Reviewer-facing / README-adjacent writeup answering why Sentinel/Gate earns its
  keep alongside [TEA](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise) (the
  free BMAD Test Architect method, which overlaps most map stages). Held to the repo's evidence bar —
  every "TEA can't" is a *verified absence* (TEA docs, 2026-07-17): leads with the two uncontested gaps
  (**mutation proof** via `audit-test`, **calibrated risk-weighted confidence** via Gate), concedes
  the soft overlaps (`coverage-review`, static quality vs `test-review`/Exspec), and carries the
  load-bearing caveat that the Gate half is **design-not-proven**. First of the `comparisons/` notes.

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
  had no owning source. TEA↔Sentinel/Gate integration seams captured in #96.
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
- **Gate `ship` now states its examined-vs-unexamined scope** (#112). The ship rationale, the report note,
  and the `gate` SKILL bullet spell out how much of the suite `audit-test` actually mutation-audited (e.g.
  "no hollow tests among the deep-audited subset — 4 of 12 mutation-audited; 8 unexamined — not evidence of
  health"), so `ship` no longer implies the *whole* suite was proven. Counts ride in prose only — honesty-guard
  #3 (no numeric field in the gate predicate) is untouched.
- **Evidence-bundle contract v0 → v0.1** ([ADR-0031](docs/adr/0031-witness-evidence-bundle-v0.1-empty-result.md)).
  Additive and backward-compatible: the new `EMPTY` execution result (see Fixed, #111) widens the `result` enum,
  so the schema — `schemaVersion`, `$id`, and both `result` enums — bumps to record it rather than let the
  published contract lie about a value the producer emits. First bump of the #102-locked contract; the reserved
  `confidence`/calibration bump signal (a MAJOR event, still blocked by honesty-guard #3) is unaffected — this
  is a MINOR enum widening with no number.
- **Honesty pass on trust wording** (#114, from the pre-launch critique). Reworded overclaiming copy to
  match what the code actually does — **no behavior change**: `audit-test`'s "**proof, not reasoning**" →
  "an execution-grounded counterexample, not reasoning (one mutation, not a suite-wide score)"; the gate's
  "certifies ship … execution-proven trustworthy" → "recommends ship … a shape-checked self-report, not an
  independent re-verification"; baseline-lock's "**catches** a 🟢 pinned to a regression" → "**flags** … a
  heuristic suspicion raised for human review, not yet a proven catch"; and every "**Nothing leaves your
  machine**" → "adds no network calls of its own" — Sentinel runs *inside* Claude Code, so your code reaches
  Anthropic's API like any session (the README privacy note now says so, and names the eval harness as the
  one maintainer-tooling Anthropic call).
- **Gate `gate` listed in the README; skill counts reconciled** (#116). The release-gate skill now
  appears in both the README skill table and the **privacy table** — that table asserts completeness, so
  an unlisted executing skill was a real gap. Count reconciled to **fourteen skill directories** (thirteen
  skills + the `/ask-sentinel` router) across the README and `evals/README` (was 12 / 13 / 14). Docs only.
- **Fine-print gaps closed** (#115). Three places where a load-bearing caveat contradicted the pitch above
  it: the TEA note's **TL;DR** now marks Witness's calibrated/learning half as a **design, not a live
  feature** (matching the body's own caveat); the reviewer quick-start (`REVIEWERS.md`) surfaces the
  **warm-dev-server / HMR** caveat (an unconfirmed-live survival is 🟡, not 🔴) instead of leaving it only in
  `reachability-check`; and the README `audit-test` pitch states the **`@cypress/grep`** single-test-isolation
  requirement instead of burying it in `run-one-test`. Docs only.
- **Internal `witness://` identifiers renamed to `gate://`** ([ADR-0033](docs/adr/0033-witness-internal-identifier-rename.md),
  completes #113). The prose/brand rename ([#122](https://github.com/TzolkinB/skills/pull/122)) deliberately
  left the plumbing alone; this finishes it: `witness.mjs` → `gate.mjs`; the `witness://` producer namespace
  and `witness.local` predicate domain → `gate://` / `gate.local`; the two schema constants bump —
  `witness-evidence-bundle/v0.1` → **`gate-evidence-bundle/v0.2`**, `witness-audit-test/v0` →
  **`gate-audit-test/v0.1`** — a rename only, no data-model change, MINOR per the same honesty-guard-#3
  reasoning as ADR-0031 (v1.0 stays reserved for calibration). Default output filename
  `witness-bundle.json` → `gate-bundle.json`. Verified: gate self-test 81/81, `lint`/`changed` self-tests,
  all touched JSON valid, eval samples resynced.
- **`proven` taxonomy renamed to `confirmed`** ([ADR-0034](docs/adr/0034-proven-confirmed-taxonomy-rename.md),
  closes [#126](https://github.com/TzolkinB/skills/issues/126)). A second hostile review kept keying on the
  headline word "proven" over its own hedges; renamed everywhere it named this evidence-provenance tier —
  not just `gate`'s schema, since `sentinel` and the project's own top-level docs quote the same tally.
  Schema fields `provenSolid`/`provenHollow` → `confirmedSolid`/`confirmedHollow`, derived `label: 'proven'`
  → `'confirmed'`; two more MINOR bumps, same honesty-guard-#3 reasoning — `gate-audit-test/v0.1` →
  **`gate-audit-test/v0.2`**, `gate-evidence-bundle/v0.2` → **`gate-evidence-bundle/v0.3`** (the label enum
  lives in both). `audit-test`/`gate`/`sentinel`/`debug-test` SKILL prose, `GLOSSARY.md`, and the top-level
  docs (README/ARCHITECTURE/CONTEXT/PLAN/REVIEWERS) updated to match; `ask-sentinel`/`audit-orchestrator`'s
  separate routing-evidence "Proven" convention deliberately left alone, tracked as
  [#131](https://github.com/TzolkinB/skills/issues/131). Verified: gate self-test green (every string
  deliberately reworded, not find-replaced blind), `lint`/`changed` self-tests, all touched JSON valid.

### Fixed

- **Gate: in-toto hedge applied consistently** (closes #132). [ADR-0032](docs/adr/0032-flatten-to-single-kimbell-skills-plugin.md)
  already decided the permanent wording — "in-toto-*shaped* Statements (not signed attestations)," never
  unqualified "in-toto Statements," never silent about the shape — but three spots had drifted from it since:
  `gate.mjs`'s header comment still said bare "in-toto Statements" (the code comment was never updated when
  ADR-0032 landed); `gate/SKILL.md` overcorrected the other way and dropped "in-toto" entirely, keeping only
  "not a signed attestation"; and `schema/evidence-bundle.v0.schema.json`'s nested `statement.description`
  said bare "An in-toto Statement" while the file's own top-level `description` two lines up correctly said
  "in-toto-shaped." All three now cite ADR-0032 and use its exact hedge. No schema-version bump — a
  description-string wording fix, not a shape/field change. The literal `_type` constant
  (`https://in-toto.io/Statement/v1`) is untouched, per [ADR-0033](docs/adr/0033-witness-internal-identifier-rename.md)
  ("the real external type... was never a 'Witness' identifier"). No new ADR — this corrects drift from an
  existing decision, not a fresh one. Verified: `gate.mjs --self-test` green, schema JSON valid,
  `evals/lint.mjs` clean on `gate/SKILL.md`.

- **Gate no longer launders non-evidence into a green `ship`** (#111, from the pre-launch critique
  `references/critique-synthesis.md`). Two disclosed exploits closed: (1) an **empty / zero-test / unrun
  execution report** (`{}`, a wrong `--playwright` path, a suite that never ran) used to derive `PASSED` and
  propose `ship-baseline`; it now derives the new **`EMPTY`** result → `hold`. (2) `parseAuditEmission` accepted
  any `witness-audit-test/*` prefix and any non-negative counts, so a hand-written `{provenSolid:1, deepAudited:0}`
  (arithmetically impossible) reached `PASSED`+`proven`+`ship`; it now matches the schema version **exactly** and
  **rejects inconsistent tallies** (`audited == deepAudited + unexamined`; `Σ(outcomes) ≤ deepAudited`), degrading
  a malformed emission to opaque/absent — never a silent upgrade. Advisory decision on the exploits: empty+fake →
  `hold`, impossible-tally → `canary`; the legit green-Playwright + real-proven-audit path still ships. 11 new
  gate self-test rows (81 total).

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
