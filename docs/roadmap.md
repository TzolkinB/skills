# Roadmap — deferred work, in build order

Source of truth for what Gate/`audit-test` deliberately left unbuilt for the 2026-07-20 MVP1
launch, and the order to pick it back up in. Each item names why it was deferred, what ships
first, and the ADR/issue that carries the detail — read those, don't re-derive here.

Two closed decisions are load-bearing context for everything below:
- **ADR-0032/0033** collapsed "Witness" → "Gate" and renamed the internal `witness://` → `gate://`
  identifiers, closing [#113](https://github.com/TzolkinB/skills/issues/113).
- **[#99](https://github.com/TzolkinB/skills/issues/99)** (closed) decided Gate stays a stage
  *inside* this plugin, not a second plugin, until calibration (item 4 below) lands — see
  [gate/SKILL.md](../skills/gate/SKILL.md) "Housing & extraction."

---

## Tier 1 — cheap, closes remaining honesty gaps

### 1. Rename the `proven` / `proven-solid` taxonomy
[#126](https://github.com/TzolkinB/skills/issues/126) (closed, 2026-07-22 via [ADR-0034](adr/0034-proven-confirmed-taxonomy-rename.md)) — `proven`/`Proven`
renamed to `confirmed`/`Confirmed` everywhere it named this evidence-provenance tier: schema fields
(`provenSolid`/`provenHollow` → `confirmedSolid`/`confirmedHollow`, `label:'proven'` → `'confirmed'`,
`gate-audit-test/v0.1` → `v0.2`, `gate-evidence-bundle/v0.2` → `v0.3`), `gate.mjs` + its self-test,
`gate`/`audit-test`/`sentinel`/`debug-test` SKILL prose, GLOSSARY.md, the top-level docs
(README/ARCHITECTURE/CONTEXT/PLAN/REVIEWERS), and the associated fixtures/eval cases. Turned out
**not** contained to one skill's contract as first estimated — `sentinel` and the project's own
top-level docs quote the same tally, so ADR-0034 corrected the scope estimate the same way
ADR-0033 corrected ADR-0032's. `ask-sentinel`/`audit-orchestrator`'s separate routing-evidence
"Proven" convention was deliberately left out and tracked as [#131](https://github.com/TzolkinB/skills/issues/131)
— **closed, 2026-07-22 via [ADR-0036](adr/0036-ask-sentinel-audit-orchestrator-confirmed-rename.md)**, same
word swap extended to the routing-evidence axis, no residual left.

### 2. Coverage-aware ship semantics
[#127](https://github.com/TzolkinB/skills/issues/127) (closed, 2026-07-22 via [ADR-0035](adr/0035-gate-examined-floor.md)) — `ship` used
to be reachable with `deepAudited:4, unexamined:8` (33% examined), disclosed honestly in the
rationale line but not gated on. `gate()` now also requires the deep-audited fraction to clear
an **examined-floor** (default 50%, `--examined-floor` overridable down to a 25% minimum,
clamped with a warning below it) before a confirmed-clean verdict can propose `ship`; short of
the floor it proposes `canary` — no new categorical rung, same shape as
[ADR-0029](adr/0029-witness-parsed-audit-test-graduation.md)'s B→A change. Closes the gap
`references/critique-synthesis.md` A3 flagged.

---

## Tier 2 — real capability, larger lift

### 3. Real evidence integrity — DSSE signing, bind emissions to execution artifacts
[#128](https://github.com/TzolkinB/skills/issues/128) (closed, 2026-07-22 via [ADR-0037](adr/0037-gate-evidence-integrity.md)) — reserved-not-built
since [ADR-0028](adr/0028-witness-gate-skill-mvp1.md), now built as a smaller, honest set of integrity
properties. Three capabilities landed: **A** — opt-in self-signed ed25519 DSSE signing of the gate
Statement ([#141](https://github.com/TzolkinB/skills/issues/141)); a signed bundle proves *integrity*
(unaltered since Gate produced it), **not** third-party identity — self-signed, never Sigstore, unsigned
by default. **B1** — content-address the ingested inputs as sha256 `subject[]` digests
([#139](https://github.com/TzolkinB/skills/issues/139)), so a report swapped from under the verdict no
longer goes unnoticed. **B2** — `audit-test` emits an optional per-test `runs[]` trace and Gate
cross-checks the tally against it ([#140](https://github.com/TzolkinB/skills/issues/140)/[#142](https://github.com/TzolkinB/skills/issues/142)),
raising the credibility input from "trust a summary number" to "trust a summary the run trace
corroborates." Schema went `v0.3 → v0.5` additively. **ADR-0037 corrected #128's stated dependency:**
it does **not** depend on [ADR-0010](adr/0010-execution-out-temporal-deferred-behind-a-seam.md)'s
execution seam — ADR-0010 ruled the Execution Gap out of scope *permanently*, so no seam is coming;
B2 binds to the run `audit-test` already performs, not one Gate runs. Honest scope: B2 hardens the
self-report, it does **not** make it trustless — Gate still never re-runs the mutation, and the
`ship`-eligibility rule is unchanged.
**Third** — real engineering, no shortcut; the maturity pass that earned back "attestation"/"signed"
language for the v1, replacing the "aggregator of self-reports" caveat `references/critique-synthesis.md`
said could not be honestly fixed for the scrapped v0 launch.

### 4. Calibration loop — numeric `confidence`
[#129](https://github.com/TzolkinB/skills/issues/129) (open). The big one. Folded into [#49](https://github.com/TzolkinB/skills/issues/49) (epic) from the
closed [#96](https://github.com/TzolkinB/skills/issues/96) Part A: a `Σ risk × credibility ×
execution` weighting + a `WAIVED` category, feeding a calibration loop that would let the gate
carry a real confidence number instead of a bare category. Schema forbids any numeric field
today on purpose — its arrival is deliberately the signal this has landed
([gate/SKILL.md](../skills/gate/SKILL.md) "No manufactured number").
**Fourth** — the highest-value item on this list, and the one every prior wayfinder pass
(#98) parked because it needs the categorical gate to have been in real use first to have
anything to calibrate against.

---

## Tier 3 — housekeeping, not urgent

### 5. Plugin independence
[#99](https://github.com/TzolkinB/skills/issues/99) (closed) already answered this: Gate earns
a standalone plugin **when item 4 lands**, not before. Nothing to do here until then —
[#130](https://github.com/TzolkinB/skills/issues/130) (open, blocked by #129) exists only so
this isn't rediscovered as an open question.

### 6. Contextual "Sentinel" de-brand
[#124](https://github.com/TzolkinB/skills/issues/124) (open) — ADR-0032/0033 retired "Sentinel"
as the umbrella brand in the README; the other ~59 file-hits (prose, not the `/sentinel` skill
identifier itself, which stays per ADR-0032 decision 2) are an unswept follow-up. Pure hygiene,
no behavior or claim changes.

### 7. Review-archive hygiene
[#117](https://github.com/TzolkinB/skills/issues/117) (closed, 2026-07-22 by commit 4fd85ff) —
rebuilt the external-review zip from `git archive HEAD` (not a stale partial tree) and
resolved whether to commit or otherwise surface the gitignored `references/witness-*`
contract assets so a future reviewer isn't missing the authorities ADR-0028–0031 cite.

---

## Adjacent backlog (tracked, not Gate-specific)

Not part of this honesty/maturity thread — listed only so this doc is a complete index:
[#50](https://github.com/TzolkinB/skills/issues/50) (executed Cypress verdict on a real runner,
cross-layer F1 test, slop-gate) and [#78](https://github.com/TzolkinB/skills/issues/78)
(selector-guard spec).
