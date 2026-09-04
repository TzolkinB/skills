# Roadmap — deferred work, in build order

`gate` and `audit-test` deliberately left some work unbuilt. This document tracks what is still
deferred, in build order. Most of what this document originally tracked for the 2026-07-20 MVP1
launch has since shipped, as part of v2.0.0 — see `CHANGELOG.md` for the release record. Closed
items stay listed below, in one or two lines each, only for the sequencing context they give the
items still open. Read the linked ADR or issue for the actual decision; do not re-derive the
reasoning here. Current Gate behavior lives in [`gate.md`](gate.md), not in this history.

**One closed decision stays load-bearing for everything below:**
[#99](https://github.com/TzolkinB/skills/issues/99) (closed) decided that Gate stays a stage
*inside* this plugin, not a second plugin, until item 4 (calibration) lands. See
[gate/SKILL.md](../skills/gate/SKILL.md), "Housing & extraction."

---

## Tier 1 — cheap, closes remaining honesty gaps

### 1. Rename the `proven` / `proven-solid` taxonomy — closed
[#126](https://github.com/TzolkinB/skills/issues/126), 2026-07-22, via
[ADR-0034](adr/0034-proven-confirmed-taxonomy-rename.md). Renamed `proven`/`Proven` to
`confirmed`/`Confirmed` across schemas, code, and docs. A separate routing-evidence "Proven"
convention (`qa-compass`/`audit-orchestrator`) got the same rename via
[#131](https://github.com/TzolkinB/skills/issues/131)/[ADR-0036](adr/0036-ask-sentinel-audit-orchestrator-confirmed-rename.md).
No old wording remains.

### 2. Coverage-aware ship semantics — closed
[#127](https://github.com/TzolkinB/skills/issues/127), 2026-07-22, via
[ADR-0035](adr/0035-gate-examined-floor.md). Added the examined-floor Gate now enforces before it
proposes `ship` — see [`gate.md`](gate.md) for current behavior.

---

## Tier 2 — real capability, larger lift

### 3. Real evidence integrity — DSSE signing, content-addressed inputs, provenance — closed
[#128](https://github.com/TzolkinB/skills/issues/128), via
[ADR-0037](adr/0037-gate-evidence-integrity.md). The freshness and provenance follow-ons closed
via [ADR-0042](adr/0042-gate-rejected-credibility-state-and-freshness-floor.md) and
[ADR-0043](adr/0043-report-to-commit-provenance-over-git-timestamp.md). A git-timestamp check was
considered and rejected as the mechanism — ADR-0043 has why. Shipped: opt-in self-signed ed25519
DSSE signing, content-addressed input digests, and an `audit-test` run-trace cross-check, all
documented in [`gate.md`](gate.md). Also shipped, but not yet documented in `gate.md`:
producer-recorded commit-SHA provenance and the `--max-age` freshness floor — see
ADR-0042/ADR-0043 for that behavior meanwhile.

### 4. Calibration loop — numeric `confidence`
[#129](https://github.com/TzolkinB/skills/issues/129) (open). This is the highest-value item on
this list. It folded in from the closed [#96](https://github.com/TzolkinB/skills/issues/96) Part
A, into epic [#49](https://github.com/TzolkinB/skills/issues/49): a
`Σ risk × credibility × execution` weighting, plus a `WAIVED` category, feeding a calibration
loop that lets the gate carry a real confidence number instead of a bare category. The schema
forbids any numeric field today, on purpose. When a numeric field arrives, that arrival is
deliberately the signal that this work has landed ([gate/SKILL.md](../skills/gate/SKILL.md), "No
manufactured number"). Every prior wayfinder pass (#98) parked this item, because it needs the
categorical gate in real use first, to have something to calibrate against.

**Not a storage problem** ([ADR-0047](adr/0047-statelessness-is-a-write-boundary-git-is-the-ledger.md)).
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

### 6. Contextual "Sentinel" de-brand — closed
[#124](https://github.com/TzolkinB/skills/issues/124) (2026-07-26, PR #182) swept umbrella-brand
prose across the top-level docs. [ADR-0052](adr/0052-rename-sentinel-skills-to-qa-compass-qa-pass.md)
(PR #229) finished it, renaming the skill identifiers themselves to `/qa-pass` and `/qa-compass`.
A small number of mentions of the old umbrella name remain deliberately, where they name history
rather than current behavior. One example: `docs/orchestration-map.md`'s fabricated-external-report
provenance note quotes what a bad report literally invented. Rewriting that quote would
misrepresent the record. Nothing further needs doing here.

### 7. Review-archive hygiene — closed
[#117](https://github.com/TzolkinB/skills/issues/117) (closed, 2026-07-22, commit 4fd85ff).
Rebuilt the external-review zip from `git archive HEAD`, and resolved how the gitignored
`references/witness-*` contract assets get surfaced to a reviewer.

---

## Adjacent backlog (tracked, not Gate-specific)

These items are not part of this honesty and maturity thread. This list names them only so this
document stays a complete index. [#50](https://github.com/TzolkinB/skills/issues/50) covers an
executed Cypress verdict on a real runner, a cross-layer F1 test, and the slop-gate.
[#78](https://github.com/TzolkinB/skills/issues/78) covers the selector-guard spec.
