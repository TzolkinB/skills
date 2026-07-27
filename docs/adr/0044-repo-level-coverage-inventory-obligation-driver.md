# A repo-level, obligation-driven coverage inventory is a **v2 driver over the existing leaf skills** — not a new judgment engine, and the `missing`-at-repo-scale axis is the one genuine gap

**Status: Proposed (2026-07-26).** Surfaced by an external community proposal —
[mattpocock/skills#654](https://github.com/mattpocock/skills/issues/654) ("a review-only test
inventory and gap analysis skill") and its two follow-up comments (xg-gh-25's *"how does it decide
what's important?"* and Seekers2001's evidence-hierarchy + `keep/consolidate/quarantine/
removal-candidate/unverifiable` classification). This ADR records **what of that proposal Sentinel
already covers, what it does not, and the shape of the net-new work** — so the gap is stated honestly
rather than claimed as "already done." It **decides the architecture and defers the build to a v2
increment.**

**Decides:** (1) the repository-level *"which important requirement / risk / past bug still has no
**verified** test?"* question is **not answerable today** and is worth building; (2) the build is a
**driver + obligation layer over the existing leaf skills**, not a new analyzer — `prune-tests` and
`audit-test` already run suite-wide, so the only missing execution axis is **`missing`-coverage at
repo scale**, which `coverage-review` cannot produce because it is **file-pair scoped by contract**;
(3) it stays **review-only**, inheriting the propose-don't-modify discipline of all three leaves;
(4) "importance" is resolved by an **evidence hierarchy** (an obligation layer), consumed for
*ranking/selection*, never for a verdict — the same manifest-consumption boundary
[ADR-0025](0025-ask-sentinel-stack-aware-router-reads-manifests.md) drew for the router.

**Defers:** the implementation itself (the driver, the obligation-ingest, the rollup format) to a v2
increment; and the decision of whether this ships as a new top-level skill or as an extension of
`ask-sentinel`/`audit-orchestrator`'s orchestration surface.

## Context

Issue #654 proposes a review-only skill that answers a **repository-level** question the per-change
skills don't: *"what does the existing suite protect, and which important requirements, risks, and
past bugs still have no verified test evidence?"* — output grouped by behavior, each item tagged
`covered / missing / duplicate / stale / unverifiable`. Seekers2001 layers a **classification**
(`keep / consolidate / quarantine / removal-candidate / unverifiable`) driven by an **evidence
hierarchy**: (1) explicit test obligations / acceptance criteria, (2) public contracts & domain
invariants, (3) specs & ADRs, (4) past bugs / incidents / security findings, (5) code structure as
*weak* supporting evidence only.

Mapping that proposal onto what Sentinel already ships (see
[`orchestration-map.md`](../orchestration-map.md), stages 3–5):

| Proposal status / class | Owned by | Notes |
|---|---|---|
| `missing` | **`coverage-review`** | its actual owned question — *what could break that these tests wouldn't catch?* |
| `covered` — **proven** | **`audit-test`** | mutation shows the test fails when the code breaks; the only "covered" that earns the word |
| `covered` — listed/asserted | `coverage-review` incidental output / raw lcov·jacoco | context, not a verdict; static mode is inference, and a line *executed* ≠ *verified* |
| `duplicate` / `consolidate` | **`prune-tests`** | scenario-boundary-gated merge |
| `stale` / `removal-candidate` | **`prune-tests`** | Out-of-Sync + Low-Value sections, confidence-scored |
| `keep` | **`prune-tests`** | conservative Keep |
| `quarantine` (valuable but flaky) | **`debug-test` flake mode** | detect → quarantine → route, never heal-to-green |
| `unverifiable` | **`audit-test`** INCONCLUSIVE + `prune-tests` low-confidence-keep | not enough authoritative evidence for a safe call |

So the **per-test judgment layer is already built**, and on one axis it *exceeds* the proposal:
#654 treats "verified vs assumed coverage" as a reasoning distinction; `audit-test` settles it by
running a targeted mutation ([ADR-0001](0001-audit-test-proves-by-execution.md)). The proposal's
`covered` is a single assertable status; Sentinel's sharper model splits it — `coverage-review` finds
the holes, `audit-test` proves the fills.

**But two seams do not exist yet, and they are the real core of #654:**

1. **Scope.** `prune-tests` (file / directory / whole suite) and `audit-test` (file / glob /
   `--changed` / whole-suite batch) already run **repo-wide**. `coverage-review` does **not**: its
   contract is `[test file] [code file]` — **one pair at a time** (Step 1 reads exactly those two
   arguments). It is the *additive gap-finder*, and the gap-finder is precisely the half #654 leads
   with. A repo-level `missing` rollup therefore has **no driver today**: you cannot find an
   *untested* module by globbing existing test files, so a repo-wide gap scan needs to enumerate
   **source units** and pair each with its tests (or flag "no test at all") — machinery none of the
   leaves own.

2. **Obligation discovery.** All three leaves rank importance from **reading the code**. None crawl
   **specs / ADRs / bug-and-issue history / an optional obligation manifest** to derive *what should
   be tested*. That is exactly xg-gh-25's open question and Seekers2001's hierarchy — and it is the
   only way to answer #654's headline case, *"does fixed bug #123 have a regression test?"*, which
   `coverage-review` structurally can't, because it ranks gaps by code-read risk, not by external
   obligation.

The two seams are **not independent**: a naive repo-wide gap scan drowns you in every uncovered getter.
The obligation layer is what makes a repo-level gap scan *usable* — it is the ranking signal that
decides which of the thousands of uncovered lines actually *matter*.

## Decision

### 1. Confirm the gap is real and worth a v2

The repository-level, obligation-anchored inventory is **net-new capability**, not a repackage. Record
it as intended v2 work rather than pretending the composed leaves already deliver it.

### 2. Build a driver over the leaves, not a new analyzer — orchestrate, don't absorb

The judgment is done; the missing piece is *sequencing + scope + rollup*. The v2 artifact:

1. **enumerates source units** across the repo (the piece that lets you see an untested module),
2. **pairs each unit with its tests**, or flags "no test at all,"
3. runs the **existing** `coverage-review` per pair for `missing`, folds in `prune-tests`
   (duplicate/stale/removal/keep) and `audit-test` (proven-covered / unverifiable) suite-wide, and
   routes flaky specs to `debug-test` for `quarantine`,
4. **merges into one report grouped by behavior**, each item cross-linked to the obligation that
   makes it matter.

This reuses the leaves as-is (no re-derivation of their questions), consistent with the map's
**orchestrate-don't-absorb** thesis and `audit-orchestrator`'s precedent. The only genuinely new
*execution* is the repo-level `missing` driver feeding `coverage-review`'s per-pair analysis.

### 3. "Importance" = an evidence hierarchy, consumed for ranking, never for a verdict

Adopt Seekers2001's hierarchy as the obligation-discovery contract: explicit obligations / acceptance
criteria → public contracts & invariants → specs & ADRs → past bugs / incidents / security findings →
code structure (weak). An **optional obligation manifest** is supported for what can't be inferred,
but is **not required for a first review** (honest degradation: no manifest → rank on what's
inferable, say so). Reading specs / bug history / a manifest to *rank and select gaps* is
**consumption, categorically distinct from analyzing code for a verdict** — the same boundary
[ADR-0025](0025-ask-sentinel-stack-aware-router-reads-manifests.md) and
[ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md) already drew.

### 4. Review-only, inheriting the propose-don't-modify discipline

The inventory **reports and classifies; it never deletes or rewrites** — matching #654's own
constraint and the existing gated-`--apply` discipline of `prune-tests`
([ADR-0003](0003-prune-tests-proposes-before-deleting.md)) and `audit-test`
([ADR-0001](0001-audit-test-proves-by-execution.md)). Any application of a `removal-candidate` remains
a separate, clean-tree-gated step owned by `prune-tests`, not this driver.

### 5. Defer the build and the packaging question

This ADR fixes the **architecture and the honest scope story**; it does not ship code. Two follow-up
decisions are deferred to the v2 increment: whether the inventory is a **new top-level skill** or an
**extension of the orchestration surface** (`ask-sentinel` already routes the whole map;
`audit-orchestrator` already drives one stage suite-wide), and the concrete **rollup output schema**
(behavior grouping + obligation cross-links).

## Considered options

- **Claim it's already covered by composing the three skills.** Rejected — dishonest on two counts:
  `coverage-review` is file-pair scoped so the repo-level `missing` axis has no driver, and no leaf
  ingests obligations, so *"which past bug has no regression test?"* is unanswerable today. Conceding
  the seam is the more credible position and the one this repo's evidence discipline demands.
- **Extend `coverage-review` itself to walk the repo.** Rejected as the *primary* framing — it would
  overload the single-pair skill with source-enumeration + obligation-ingest + rollup, three concerns
  it doesn't own. The pair-level judgment stays where it is; the driver sits above it. (A thin
  repo-mode flag on `coverage-review` may still fall out as an implementation detail, but the
  obligation layer and rollup are not its job.)
- **Build a fresh repo-level analyzer from scratch.** Rejected — re-deriving `missing` / `duplicate` /
  `stale` / `proven` judgments the leaves already make would create drift and contradict
  orchestrate-don't-absorb. The value is the driver + obligation layer, not new judgment.
- **Require an obligation manifest.** Rejected — a hard input barrier defeats the "works on an
  AI-generated repo with no docs" stance (the same reason `coverage-review` never *requires*
  instrumentation). The manifest is an optional sharpener over an inferable-first hierarchy.
- **Ship it now.** Rejected — it's a v2. This ADR records the decision and shape so the thread reply
  and the roadmap can point at a real, scoped commitment instead of a vague "we could."

## Consequences

- **The #654 reply can be honest and specific:** the per-test classification is already built (and
  `audit-test` makes "verified" a proof, not a claim), while the repo-level obligation-mapped
  inventory is real net-new work — named, scoped, and filed rather than hand-waved.
- **`coverage-review`'s file-pair contract is now a documented boundary**, not an accident — the
  repo-level `missing` rollup is explicitly a driver's job, above the pair-level skill.
- **The obligation-discovery layer becomes a reusable seam** — the same evidence hierarchy could later
  feed `test-plan` / `threat-model` (ranking by real obligations, not just diff blast radius).
- **A v2 issue is filed** — [TzolkinB/skills#180](https://github.com/TzolkinB/skills/issues/180) —
  capturing the driver + obligation layer + rollup schema, with the packaging decision (new skill vs.
  orchestration-surface extension) as its first open question.
- **The orchestration map gains a candidate stage-0 / cross-stage capability** — a repo-level
  "obligation ↔ verified-coverage" inventory that sits across stages 3–5 rather than inside one.

## Follow-up: Seekers2001's reply (2026-07-26)

Seekers2001 replied to confirm the boundary this ADR already drew, narrowing their own proposal
rather than expanding it: they are **not** proposing coverage analysis, pruning, flaky-test
handling, or mutation-based auditing — agreeing those are Sentinel's WIP skills' job, not
theirs. They frame their layer as one step earlier than test evidence: *authoritative project
intent → test obligations → executable test evidence*, with docs (specs, acceptance criteria,
contracts, ADRs, incident records) and tests (TDD) as complementary, not interchangeable — the
proposed layer periodically reconnects the two.

Two things worth recording:

1. **They explicitly decline to propose their own artifact.** Their `docs-governance` /
   `test-collaboration` skill uses a TESTS.md/TEST-ID model, but they are not asking this repo to
   adopt it — only the "evidence discipline" (derive obligations from authoritative intent →
   map each obligation to runnable test evidence → distinguish confirmed from missing/unverifiable
   → aggregate by observable behavior, not test function) is offered as transferable. This is
   independent confirmation of Decision §3 and the "Require an obligation manifest" rejection
   above: the obligation layer should stay artifact-agnostic, not standardize on any one
   project's manifest format.
2. **They restate Sentinel's WIP skills as "specialist reviewers underneath that layer"** and name
   the missing piece as *"the thin repository-level intent mapper and aggregator"* — independent
   external agreement with Decision §2 (driver over the leaves, not a new analyzer) and this ADR's
   framing of the obligation-discovery layer + rollup as the net-new work.

Their closing question — *"what minimal structured output would let these responsibilities compose
without duplicating one another"* — is a direct, externally-motivated ask for the **rollup output
schema**, deferred in Decision §5 and tracked as open question #2 in
[TzolkinB/skills#180](https://github.com/TzolkinB/skills/issues/180). No architecture decision
here changes; this promotes that schema from an internal open question to the concrete next thing
a reply owes them.
