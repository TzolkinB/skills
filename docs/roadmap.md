# Roadmap — deferred work, in build order

This document is the source of truth for work that Gate and `audit-test` deliberately left
unbuilt for the 2026-07-20 MVP1 launch. It lists the build order for that work. Each item names
why the team deferred it, what ships first, and the ADR or issue that carries the detail. Read
those documents; do not re-derive the reasoning here.

Two closed decisions give load-bearing context for everything below:
- **ADR-0032/0033** collapsed "Witness" into "Gate" and renamed the internal `witness://`
  identifiers to `gate://`. This closed [#113](https://github.com/TzolkinB/skills/issues/113).
- **[#99](https://github.com/TzolkinB/skills/issues/99)** (closed) decided that Gate stays a
  stage *inside* this plugin, not a second plugin, until calibration (item 4 below) lands. See
  [gate/SKILL.md](../skills/gate/SKILL.md), "Housing & extraction."

---

## Tier 1 — cheap, closes remaining honesty gaps

### 1. Rename the `proven` / `proven-solid` taxonomy
[#126](https://github.com/TzolkinB/skills/issues/126) (closed, 2026-07-22 via
[ADR-0034](adr/0034-proven-confirmed-taxonomy-rename.md)). This item renamed `proven`/`Proven`
to `confirmed`/`Confirmed` everywhere the old term named this evidence tier. The rename touched:

- Schema fields: `provenSolid`/`provenHollow` became `confirmedSolid`/`confirmedHollow`;
  `label:'proven'` became `'confirmed'`; `gate-audit-test/v0.1` became `v0.2`;
  `gate-evidence-bundle/v0.2` became `v0.3`.
- `gate.mjs` and its self-test.
- The SKILL prose for `gate`, `audit-test`, `sentinel`, and `debug-test`.
- `GLOSSARY.md` and the top-level docs (README, ARCHITECTURE, CONTEXT, PLAN, REVIEWERS).
- The matching fixtures and eval cases.

The first estimate scoped this rename to one skill's contract; that estimate was too narrow.
`sentinel` and the project's own top-level docs quote the same tally, so ADR-0034 corrected the
scope estimate, the same way ADR-0033 corrected ADR-0032's. `ask-sentinel` and `audit-orchestrator` used a separate routing-evidence "Proven"
convention. The team deliberately left that convention out of this item and tracked it as
[#131](https://github.com/TzolkinB/skills/issues/131) — **closed, 2026-07-22 via
[ADR-0036](adr/0036-ask-sentinel-audit-orchestrator-confirmed-rename.md)**. That closure extended
the same word swap to the routing-evidence axis. No old wording remains.

### 2. Coverage-aware ship semantics
[#127](https://github.com/TzolkinB/skills/issues/127) (closed, 2026-07-22 via
[ADR-0035](adr/0035-gate-examined-floor.md)). Before this fix, `ship` was reachable with
`deepAudited:4, unexamined:8` (33% examined). The rationale line disclosed this honestly, but the
gate did not check it. Now `gate()` also requires the deep-audited fraction to clear an
**examined-floor** (default 50%). The flag `--examined-floor` overrides that default, down to a
25% minimum; a lower value is clamped to 25%, with a warning. A confirmed-clean verdict needs
that floor before it proposes `ship`. Short of the floor, it proposes `canary` instead — the same
shape as [ADR-0029](adr/0029-witness-parsed-audit-test-graduation.md)'s B→A change, with no new
categorical rung. This closes the gap that `references/critique-synthesis.md` flagged as A3.

---

## Tier 2 — real capability, larger lift

### 3. Real evidence integrity — DSSE signing, content-addressed inputs
[#128](https://github.com/TzolkinB/skills/issues/128) (closed, 2026-07-22 via
[ADR-0037](adr/0037-gate-evidence-integrity.md)). [ADR-0028](adr/0028-witness-gate-skill-mvp1.md)
reserved this work without building it. The team has now built it, as a smaller, honest set of
integrity properties. Three capabilities landed:

- **A** — opt-in self-signed ed25519 DSSE signing of the gate Statement
  ([#141](https://github.com/TzolkinB/skills/issues/141)). A signed bundle proves *integrity* —
  nobody altered it after Gate produced it. It does **not** prove third-party identity: the
  signing is self-signed, never Sigstore, and off by default.
- **B1** — content-addresses the ingested inputs as sha256 `subject[]` digests
  ([#139](https://github.com/TzolkinB/skills/issues/139)), so a report swapped in under the
  verdict no longer goes unnoticed.
- **B2** — `audit-test` emits an optional per-test `runs[]` trace, and Gate cross-checks the
  tally against it ([#140](https://github.com/TzolkinB/skills/issues/140)/[#142](https://github.com/TzolkinB/skills/issues/142)).
  This raises the credibility input from "trust a summary number" to "trust a summary the run
  trace corroborates." The schema moved from `v0.3` to `v0.5`, additively.

ADR-0037 corrected #128's stated dependency: this work does **not** depend on
[ADR-0010](adr/0010-execution-out-temporal-deferred-behind-a-seam.md)'s execution seam. ADR-0010
ruled the Execution Gap out of scope *permanently*, so no such seam will exist. B2 binds to the
run `audit-test` already performs, not to a run Gate performs itself. Honest scope: B2 hardens
the self-report; it does **not** make the self-report trustless. Gate still never re-runs the
mutation, and the `ship`-eligibility rule is unchanged.

**Third** — real engineering, with no shortcut. This maturity pass earned back "attestation" and
"signed" language for v1. It replaces the "aggregator of self-reports" caveat.
`references/critique-synthesis.md` said the scrapped v0 launch had no honest fix for that
caveat.

**Closed** (hostile-review finding #3, 2026-07-25,
[ADR-0042](adr/0042-gate-rejected-credibility-state-and-freshness-floor.md) and
[ADR-0043](adr/0043-report-to-commit-provenance-over-git-timestamp.md)). An opt-in
`--max-age=<minutes>` flag catches a stale report. Gate compares the report's claimed start time
to the flag value, relative to when the bundle was assembled. If the report is older than that,
the suite is capped at `canary`. This closes the "stale leftover `results.json`" case.
Producer-recorded SHA provenance
([#177](https://github.com/TzolkinB/skills/issues/177), below) closes the remaining "fresh
report, wrong commit" case.

**Closed — report-to-commit provenance** ([#177](https://github.com/TzolkinB/skills/issues/177),
[ADR-0043](adr/0043-report-to-commit-provenance-over-git-timestamp.md)). `--max-age`, above,
catches a stale *leftover* report. On its own, it does not bind a report to the specific
`--commit` Gate was told to gate. Without this check, a fresh-looking report regenerated moments
before a *different* commit's gate run still passes.

The team examined a deferred git-timestamp idea: resolve the commit's own
`git show -s --format=%cI` and compare it to the report's `startedOn`. The team **rejected this
as the mechanism**, for two reasons.

First, it does not even catch this scenario. A report regenerated *now*, for the wrong commit,
has `startedOn` at approximately the current time — a time at or after any commit timestamp. The
report still reads as fresh.

Second, the only signal this method gives is "the report predates the commit." This collides
with the ordinary local workflow: test the working tree, then commit. That workflow legitimately
produces a `startedOn` value earlier than the commit time. If the team adopted this check, it
flags honest runs by mistake. It also needs an operator-supplied grace window with no universal
default — the same problem `--max-age` hit (ADR-0042 §3). A timestamp is an unreliable stand-in
for the real question: did this report actually run against this commit's code?

**The shipped closure — producer-recorded SHA provenance.** This measures the real question
directly, instead of using a wall-clock as a stand-in. The Playwright and Cypress ingest adapters
record the git commit that `gate.mjs` itself ran against. The value is `GITHUB_SHA` (or an
equivalent CI-supplied SHA) if set, otherwise `git rev-parse HEAD`. They also record a
dirty-worktree flag, from `git status --porcelain`. Both values capture on every invocation,
always, with no flag needed. The `audit-test` emission carries its own version of this data — `commitSha` and `dirty`
in the `--emit-json` output, captured by the model at audit time (`gate-audit-test/v0.4`).
`gate()` cross-checks the recorded `commitSha` against `--commit`. A mismatch caps an
otherwise-`ship` proposal at `canary`, named in rationale prose only; this adds no new field to
`gatePredicate.inputs[]` (honesty guard #1/#3 unaffected). A report with no recorded SHA is
unaffected either way — this check is necessary, not sufficient, the same discipline as
content-addressing and the floors.

This method is exact, not dependent on an unreliable clock. It actually catches the case of a
fresh report for the wrong commit (recorded SHA `D` does not match gated commit `C`). It is the
natural next step after [ADR-0037](adr/0037-gate-evidence-integrity.md)'s "bind the decision to
exact bytes." It binds the report to the exact commit it ran against — the in-toto *materials*
the product already points toward. The schema moved to `gate-evidence-bundle/v0.9` (additive:
`producer.commitSha`/`producer.dirty`).

**Honest, not proof against an adversary.** If a producer lies about its own recorded SHA, the
content-addressed input bytes still do not match the real commit. This check closes the
*accidental* wrong-commit case only: a stale local checkout, or a mismatched CI trigger event. It
does not stop a motivated adversary. Gate stays advisory — it never fails the build — and
self-signed, not a third-party trust root. Defeating a deliberate adversary stays outside its
honest threat model, the same as everywhere else in this file.

### 4. Calibration loop — numeric `confidence`
[#129](https://github.com/TzolkinB/skills/issues/129) (open). This is the largest item on this
list. It folded in from the closed [#96](https://github.com/TzolkinB/skills/issues/96) Part A,
into epic [#49](https://github.com/TzolkinB/skills/issues/49): a
`Σ risk × credibility × execution` weighting, plus a `WAIVED` category. Together they feed a
calibration loop. That loop lets the gate carry a real confidence number instead of a bare
category. The schema forbids any numeric field today, on purpose. When a numeric field arrives,
that arrival is deliberately the signal that this work has landed
([gate/SKILL.md](../skills/gate/SKILL.md), "No manufactured number").

**Fourth** — the highest-value item on this list. Every prior wayfinder pass (#98) parked it,
because it needs the categorical gate in real use first, to have something to calibrate against.

**Not a storage problem**
([ADR-0047](adr/0047-statelessness-is-a-write-boundary-git-is-the-ledger.md)).
[#200](https://github.com/TzolkinB/skills/issues/200) briefly grouped this item with the
auto-repair ledger, as one "does the repo adopt a persistent store" question. That grouping is
wrong. The real blockers are different. First, no labeled *outcomes* exist yet: an override
records the human's call, but never whether that call was later proven right. Second, no one has
used the system at volume yet, so there are no outcomes to label.

If the team retires this item, Gate becomes permanently advisory by that decision alone, and the
#99/#130 plugin-independence trigger silently retires too. For that reason, this item stays open.
The full recovered rationale and the revisit trigger are in ADR-0047.

---

## Tier 3 — housekeeping, not urgent

### 5. Plugin independence
[#99](https://github.com/TzolkinB/skills/issues/99) (closed) already answered this question:
Gate earns a standalone plugin **when item 4 lands**, not before. There is nothing to do here
until then. [#130](https://github.com/TzolkinB/skills/issues/130) (open, blocked by #129) exists
only so nobody rediscovers this as an open question.

### 6. Contextual "Sentinel" de-brand — done
[#124](https://github.com/TzolkinB/skills/issues/124) (closed 2026-07-26, PR #182) swept the
umbrella-brand prose across the top-level docs. It deliberately left the `/sentinel` and
`/ask-sentinel` skill identifiers alone, per ADR-0032 decision 2. That carve-out was the one
piece still open. [ADR-0052](adr/0052-rename-sentinel-skills-to-qa-compass-qa-pass.md) (PR #229)
closed it: the identifiers themselves are now `/qa-pass` and `/qa-compass`. That same change
swept every remaining functional-prose mention of "Sentinel" that described their current
behavior.

What is left anywhere in the repo is a small number of mentions that name the old *umbrella*
product as history, not either current skill. One example: `docs/orchestration-map.md`'s
fabricated-external-report provenance note. It quotes what a bad report literally invented.
Rewriting that quote misrepresents the record instead of fixing it. Nothing further needs doing
here.

### 7. Review-archive hygiene
[#117](https://github.com/TzolkinB/skills/issues/117) (closed, 2026-07-22 by commit 4fd85ff).
This item rebuilt the external-review zip from `git archive HEAD`, instead of a stale partial
tree. It also resolved how to handle the gitignored `references/witness-*` contract assets. The
choice was between committing them and surfacing them another way. Either path keeps a future
reviewer from missing the authorities that ADR-0028–0031 cite.

---

## Adjacent backlog (tracked, not Gate-specific)

These items are not part of this honesty and maturity thread. This list names them only so this
document stays a complete index. [#50](https://github.com/TzolkinB/skills/issues/50) covers an
executed Cypress verdict on a real runner, a cross-layer F1 test, and the slop-gate.
[#78](https://github.com/TzolkinB/skills/issues/78) covers the selector-guard spec.
