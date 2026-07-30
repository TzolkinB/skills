# Architecture Decision Records

This directory is the append-only record of *why* this repo is shaped the way it is. Each ADR
captures one decision, the alternatives that lost, and what it costs us. The title of an ADR **is**
the decision — you should be able to read this index alone and know what was decided.

## The rules

- **An accepted ADR is never edited or deleted, even when it turns out wrong.** If reality changes,
  write a *new* ADR that supersedes it and add a pointer at the top of the old one. The obsolete
  reasoning is the point — it answers "why did we ever do it that way."
- **Amendments are ADRs too.** A decision that narrows, widens, or reverses an earlier one gets its
  own number and names what it supersedes.
- **Not everything needs one.** An ADR is for a decision with a real alternative and a real cost.
  Routine implementation choices belong in the code and the PR.

## Status vocabulary

| Status | Meaning |
|---|---|
| **Proposed** | Decided in shape, not in force. The only status that behaves like a to-do — each one should name a tracking issue. |
| **Accepted** | In force. Reversing it requires a new ADR. |
| **Superseded by ADR-XXXX** | No longer in force. Kept as history; the superseding ADR is authoritative. |
| **Rejected** | Considered and declined. Kept so the idea is not re-litigated. |

> ADRs 0001–0016 predate the `Status` convention (it starts at 0017). Their statuses were backfilled
> on 2026-07-29, dated from the commit that introduced each file.

## Open decisions

The four ADRs that are **not yet in force**. This is the list worth sweeping at each release — a
`Proposed` ADR that shipped and was never flipped is how a decision log starts lying.

| # | Decision | Tracking |
|---|---|---|
| [0017](0017-audit-test-baseline-lock-suspected.md) | `audit-test` flags a suspected baseline-lock as its own finding, not a 🟢 | Gap proven (EXPERIMENT-0002); remedy designed, unbuilt |
| [0023](0023-selector-guard-static-testid-drift-check.md) | `selector-guard` — static test-id reconciliation before a browser launches | [#78](https://github.com/TzolkinB/skills/issues/78), post-v1 fast-follow |
| [0026](0026-live-evals-opt-in-pr-and-scheduled-drift.md) | Live skill-eval runs are opt-in per PR and scheduled for drift | `--live` is wired in `run-eval.mjs`; the CI trigger model is unbuilt |
| [0044](0044-repo-level-coverage-inventory-obligation-driver.md) | Repo-level obligation-driven coverage inventory as a v2 driver | [mattpocock/skills#654](https://github.com/mattpocock/skills/issues/654) |

## Index

| # | Decision | Status |
|---|---|---|
| [0001](0001-audit-test-proves-by-execution.md) | `audit-test` proves false confidence by running a targeted mutation, not by reasoning alone | Accepted 2026-07-08 |
| [0002](0002-sentinel-is-judgment-not-release-evidence.md) | Sentinel produces QA judgment, not release evidence — the evidence pipeline is a separate plugin | Accepted 2026-07-08 |
| [0003](0003-prune-tests-proposes-before-deleting.md) | `prune-tests` is suite-level maintenance that proposes before it deletes | Accepted 2026-07-08 |
| [0004](0004-audit-test-is-judgment-not-a-stryker-substitute.md) | `audit-test` is judgment bounded by a triage funnel; Stryker is the exhaustive route, reached by a seam | Accepted 2026-07-09 |
| [0005](0005-match-quality-bar-not-scope.md) | Match the quality bar of a maintained plugin product, not the scope of a workflow-OS | Accepted 2026-07-09 |
| [0006](0006-bundled-two-plugin-marketplace-repo.md) | A bundled multi-plugin marketplace repo installed via a manifest | **Superseded by [0032](0032-flatten-to-single-kimbell-skills-plugin.md)** |
| [0007](0007-sentinel-sacred-path-fail-override.md) | CAUTION stays the default, but a sacred path forces an un-overridable FAIL | Accepted 2026-07-09 |
| [0008](0008-release-discipline.md) | A release is a version bump landing on the default branch, tracked by a changelog and a script | Accepted 2026-07-09 |
| [0009](0009-coverage-review-consumes-coverage-not-produces-it.md) | `coverage-review` consumes line coverage as evidence; the analyzer is a route, not a rival | Accepted 2026-07-09 |
| [0010](0010-execution-out-temporal-deferred-behind-a-seam.md) | Static judgment layer: live execution stays out, temporal memory deferred behind a seam | Accepted 2026-07-09 |
| [0011](0011-coverage-review-prefers-real-instrumentation.md) | `coverage-review` prefers real instrumentation, falling back to static inference | Accepted 2026-07-09 |
| [0012](0012-debug-test-flake-mode.md) | `debug-test` gains a flake mode that detects, quarantines, and routes — it does not rebuild the runner | Accepted 2026-07-09 |
| [0013](0013-evidence-provenance-sentinel-labels-not-gates.md) | Every verdict input carries evidence provenance; Sentinel labels, it does not gate on execution | Accepted 2026-07-10 · 🟢-clause superseded by [0039](0039-audit-test-green-requires-execution.md) |
| [0014](0014-sacred-path-integrity-discovery-fails-loud.md) | The sacred-path FAIL fails loud, never silent: zero matches is INCONCLUSIVE | Accepted 2026-07-10 |
| [0015](0015-shared-behavior-contract-read-with-merge-go-plan.md) | Three skills share one behavior-contract read; the three-into-one merge is designed but not taken | Accepted 2026-07-10 |
| [0016](0016-audit-test-reachability-guard.md) | `audit-test` gates a 🔴 behind a harness-reachability check | Accepted 2026-07-10 |
| [0017](0017-audit-test-baseline-lock-suspected.md) | A suspected baseline-lock is its own finding, not a 🟢 | **Proposed** |
| [0018](0018-debug-test-drift-triage.md) | `debug-test` drift mode: classify an already-red test as external drift vs. code regression | Accepted 2026-07-13 |
| [0019](0019-audit-test-reachability-warm-dev-propagation.md) | Reachability covers warm dev-server propagation, not just a stale build | Accepted 2026-07-13 |
| [0020](0020-suite-trigger-model-leaves-user-invoked.md) | Trigger model: leaf skills are user-invoked, discovery goes through the router | Accepted 2026-07-14 |
| [0021](0021-contract-guard-consumer-side-openapi-differ.md) | `contract-guard` is a tiered recommend-then-differ consumer-side contract check | Accepted 2026-07-15 |
| [0022](0022-skill-eval-harness-asserts-tokens-judges-prose.md) | The skill-eval harness asserts on tokens, judges prose against the rubric, never diffs output | Accepted 2026-07-15 |
| [0023](0023-selector-guard-static-testid-drift-check.md) | `selector-guard` — static test-id reconciliation before a browser launches | **Proposed** |
| [0024](0024-skill-evals-change-detection-report-first-ci.md) | Skill-eval CI runs only the diff's affected skills, and reports before it gates | Accepted 2026-07-15 |
| [0025](0025-ask-sentinel-stack-aware-router-reads-manifests.md) | `ask-sentinel` routes the whole map — own and external tools, stack-aware, provenance-labelled | Accepted 2026-07-16 |
| [0026](0026-live-evals-opt-in-pr-and-scheduled-drift.md) | Live eval runs are opt-in per PR and scheduled for drift — report-first, never an auto-gate | **Proposed** |
| [0027](0027-ask-sentinel-orchestrated-sequence-mode.md) | `ask-sentinel` gains a sequence mode: situation + stack → an ordered stage path | Accepted 2026-07-16 |
| [0028](0028-witness-gate-skill-mvp1.md) | Gate ships as a deterministic, advisory stage-7 skill — MVP1 | Accepted 2026-07-17 |
| [0029](0029-witness-parsed-audit-test-graduation.md) | Gate ingests a parsed `audit-test` verdict — the B→A graduation that unlocks `ship` | Accepted 2026-07-18 |
| [0030](0030-witness-cypress-ingest.md) | Gate ingests Cypress — flake derived from attempts, worst-wins on the execution axis | Accepted 2026-07-18 |
| [0031](0031-witness-evidence-bundle-v0.1-empty-result.md) | Evidence-bundle contract v0 → v0.1 — an additive `EMPTY` execution result | Accepted 2026-07-18 |
| [0032](0032-flatten-to-single-kimbell-skills-plugin.md) | Flatten to a single `kimbell-skills` plugin; retire "Sentinel" umbrella; "Witness" → "Gate" | Accepted 2026-07-18 |
| [0033](0033-witness-internal-identifier-rename.md) | Rename internal `witness://` identifiers to `gate://` — schema v0.1/v0 → v0.2/v0.1 | Accepted 2026-07-19 |
| [0034](0034-proven-confirmed-taxonomy-rename.md) | Rename the `proven` taxonomy to `confirmed` — schema v0.1/v0.2 → v0.2/v0.3 | Accepted 2026-07-22 |
| [0035](0035-gate-examined-floor.md) | Gate requires a minimum examined-fraction to reach `ship` | Accepted 2026-07-22 |
| [0036](0036-ask-sentinel-audit-orchestrator-confirmed-rename.md) | Extend `proven` → `confirmed` to the router's routing-evidence label | Accepted 2026-07-22 |
| [0037](0037-gate-evidence-integrity.md) | Sign the bundle, content-address the inputs, bind `audit-test` to its run | Accepted 2026-07-22 |
| [0038](0038-gate-trust-boundary-and-examined-floor-population.md) | Gate is an aggregator, not an executor; certify with breadth, not funnel-inflation | Accepted 2026-07-24 |
| [0039](0039-audit-test-green-requires-execution.md) | `audit-test`'s 🟢 requires an executed, failing mutation — cut the reasoning-only escape hatch | Accepted 2026-07-24 |
| [0040](0040-widen-gate-signed-scope-to-entries.md) | Widen the signed scope to entries: digest-bind, don't sign-all | Accepted 2026-07-24 |
| [0041](0041-audit-test-certification-mode-verdict-semantics.md) | Certification mode: a sampled clean test with no mutation is Unexamined, not 🟡 | Accepted 2026-07-25 |
| [0042](0042-gate-rejected-credibility-state-and-freshness-floor.md) | A distinct `rejected` credibility state, and an opt-in freshness floor with no default | Accepted 2026-07-25 · one considered option superseded by [0043](0043-report-to-commit-provenance-over-git-timestamp.md) |
| [0043](0043-report-to-commit-provenance-over-git-timestamp.md) | Bind a report to its commit via producer-recorded SHA provenance, not a git-timestamp check | Accepted 2026-07-25 |
| [0044](0044-repo-level-coverage-inventory-obligation-driver.md) | A repo-level obligation-driven coverage inventory is a v2 driver over the leaf skills | **Proposed** |
| [0045](0045-business-risk-coverage-is-a-join-not-a-register.md) | Business-risk coverage is a stateless join over an external matrix, not a register of our own | Accepted 2026-07-29 |
| [0046](0046-does-sentinel-become-stateful.md) | Does Sentinel become a stateful tool? | Superseded by [0047](0047-statelessness-is-a-write-boundary-git-is-the-ledger.md) |
| [0047](0047-statelessness-is-a-write-boundary-git-is-the-ledger.md) | Statelessness is a write-boundary property, and git is the heal ledger | Accepted 2026-07-30 · supersedes [0046](0046-does-sentinel-become-stateful.md) |
| [0048](0048-shared-digest-card-and-inline-next-footers.md) | Judgement skills share one `--digest` card and one inline `Next:` footer; compression never upgrades a label | Accepted 2026-07-30 |

## By area

- **Suite philosophy and scope** — [0002](0002-sentinel-is-judgment-not-release-evidence.md), [0005](0005-match-quality-bar-not-scope.md), [0010](0010-execution-out-temporal-deferred-behind-a-seam.md), [0013](0013-evidence-provenance-sentinel-labels-not-gates.md), [0020](0020-suite-trigger-model-leaves-user-invoked.md), [0038](0038-gate-trust-boundary-and-examined-floor-population.md), [0045](0045-business-risk-coverage-is-a-join-not-a-register.md), [0046](0046-does-sentinel-become-stateful.md), [0047](0047-statelessness-is-a-write-boundary-git-is-the-ledger.md), [0048](0048-shared-digest-card-and-inline-next-footers.md)
- **`audit-test`** — [0001](0001-audit-test-proves-by-execution.md), [0004](0004-audit-test-is-judgment-not-a-stryker-substitute.md), [0016](0016-audit-test-reachability-guard.md), [0017](0017-audit-test-baseline-lock-suspected.md), [0019](0019-audit-test-reachability-warm-dev-propagation.md), [0039](0039-audit-test-green-requires-execution.md), [0041](0041-audit-test-certification-mode-verdict-semantics.md)
- **`coverage-review`** — [0009](0009-coverage-review-consumes-coverage-not-produces-it.md), [0011](0011-coverage-review-prefers-real-instrumentation.md), [0044](0044-repo-level-coverage-inventory-obligation-driver.md)
- **`debug-test`** — [0012](0012-debug-test-flake-mode.md), [0018](0018-debug-test-drift-triage.md), [0047](0047-statelessness-is-a-write-boundary-git-is-the-ledger.md)
- **`prune-tests`** — [0003](0003-prune-tests-proposes-before-deleting.md)
- **`/sentinel` verdict and the sacred path** — [0007](0007-sentinel-sacred-path-fail-override.md), [0014](0014-sacred-path-integrity-discovery-fails-loud.md)
- **Drift guards** — [0021](0021-contract-guard-consumer-side-openapi-differ.md), [0023](0023-selector-guard-static-testid-drift-check.md)
- **Routing (`ask-sentinel` / `audit-orchestrator`)** — [0025](0025-ask-sentinel-stack-aware-router-reads-manifests.md), [0027](0027-ask-sentinel-orchestrated-sequence-mode.md), [0036](0036-ask-sentinel-audit-orchestrator-confirmed-rename.md), [0048](0048-shared-digest-card-and-inline-next-footers.md)
- **Gate and the evidence bundle** — [0028](0028-witness-gate-skill-mvp1.md), [0029](0029-witness-parsed-audit-test-graduation.md), [0030](0030-witness-cypress-ingest.md), [0031](0031-witness-evidence-bundle-v0.1-empty-result.md), [0033](0033-witness-internal-identifier-rename.md), [0034](0034-proven-confirmed-taxonomy-rename.md), [0035](0035-gate-examined-floor.md), [0037](0037-gate-evidence-integrity.md), [0040](0040-widen-gate-signed-scope-to-entries.md), [0042](0042-gate-rejected-credibility-state-and-freshness-floor.md), [0043](0043-report-to-commit-provenance-over-git-timestamp.md)
- **Skill evals** — [0022](0022-skill-eval-harness-asserts-tokens-judges-prose.md), [0024](0024-skill-evals-change-detection-report-first-ci.md), [0026](0026-live-evals-opt-in-pr-and-scheduled-drift.md)
- **Packaging and release** — [0006](0006-bundled-two-plugin-marketplace-repo.md), [0008](0008-release-discipline.md), [0032](0032-flatten-to-single-kimbell-skills-plugin.md)
- **Cross-cutting internals** — [0015](0015-shared-behavior-contract-read-with-merge-go-plan.md)

## Adding one

Next number, kebab-case slug, and the file opens:

```markdown
# <the decision, stated as a sentence>

**Status: Proposed (YYYY-MM-DD).** <one line of context, and the issue it tracks>

## Context
## Considered options
## Decision
## Consequences
```

Then add a row here. If it changes an earlier decision, say so in the Status line of *both* files —
the new one names what it supersedes, the old one gets a pointer forward.
