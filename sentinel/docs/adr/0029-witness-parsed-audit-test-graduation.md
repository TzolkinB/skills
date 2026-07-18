# Witness ingests a parsed audit-test verdict — the B→A graduation that unlocks `ship`

**Status: Accepted (2026-07-18).** Continues epic [#49](https://github.com/TzolkinB/skills/issues/49) directly
on top of the MVP1 Gate skill ([ADR-0028](0028-witness-gate-skill-mvp1.md), PR #106). Wayfinder map
[#98](https://github.com/TzolkinB/skills/issues/98) named this increment explicitly out of its own scope and
endorsed it as "the next Witness effort" — the one thing that lifts the gate's ceiling off `canary`.

## Context

MVP1 shipped with `ship` **reserved but unreachable**: the credibility axis floors at `canary` whether the
`audit-test` report is present-but-opaque (`human-must-read`) or absent (`no-credibility-evidence`), so a bare
green Playwright run can never launder into `ship`. That is the correct *theater guard* — but it also means
running `/audit-test` well earns you nothing toward a release verdict, because Witness cannot machine-read a
prose Markdown report.

The map's locked decisions already pointed at the fix. The evidence-bundle contract
([#102](https://github.com/TzolkinB/skills/issues/102)) reserved `verdict.label ∈ {proven, likely, unexamined}`
(the in-toto Test-Result ternary from the prior-art survey, [#101](https://github.com/TzolkinB/skills/issues/101))
and left `ship` in the `decision` enum. ADR-0002 pre-assigned *building* a structured emission mode for
`audit-test`'s labels to "the pipeline" (= Witness). So the graduation is: give `audit-test` a machine-readable
emission, teach Witness to ingest it as a **parsed** verdict, and define the gate rule that lets an
execution-proven-clean credibility verdict propose `ship`.

## Decision

**1. `audit-test` gains a structured emission (`--emit-json=<path>`).** It writes its batch **provenance tally**
— the per-class *counts* (`provenSolid`/`provenHollow`/`likelyHollow`/`baselineLock`/`unexamined`,
`deepAudited`, `audited`) — as a `witness-audit-test/v0` JSON file, in addition to the unchanged human report.
The counts are the model's per-test judgment (which test is hollow) crystallised into numbers; emission adds
**no new judgment**. Contract: `sentinel/skills/gate/schema/audit-test-emission.v0.schema.json`. No `confidence`
field — its arrival remains the signal calibration has landed.

**2. Witness derives the category; the gate reads only the category.** The ingest layer
(`auditTestParsedEntry`) reads the counts and **derives** `verdict.result` and `verdict.label` mechanically —
exactly as `deriveResult` restates Playwright's `stats`:

- `result` = `provenHollow>0 ? FAILED : (likelyHollow>0 || baselineLock>0) ? WARNED : PASSED`
- `label` = `(provenSolid>0 || provenHollow>0) ? proven : deepAudited>0 ? likely : unexamined`

The raw counts stay in the evidence entry's `metrics[]`; the **gate predicate never reads a number** (honesty
guard #1 preserved). Deriving the label *at ingest* — rather than trusting a skill-supplied label — is what
makes the theater guard **structural**: a run that deep-audited nothing derives `unexamined`, which can never
reach `ship`.

**3. The gate rule: `ship` iff execution-proven clean.** A parsed `audit-test` input proposes `ship` **only**
when `result=PASSED` **and** `label=proven`; every other parsed verdict proposes `canary`; a proven-hollow
finding (`result=FAILED`) proposes **`canary`, not `hold`** — a hollow test is a test-quality defect, not a
proven code failure, so it blocks `ship` but does not stop a shippable release; `hold` stays owned by Playwright
(red execution / no evidence). Combined with worst-wins, **`ship` is reachable iff Playwright PASSED *and* a
parsed `audit-test` verdict is `PASSED`+`proven`** — a high, honest, execution-proven bar. Opaque and absent
audit-test keep their `canary` floors unchanged.

**4. No schema-version bump.** The v0 schema already reserved `label` and `ship`; the only additive change is a
non-numeric `label` enum on the gate `inputs[]` items (for "show its work"). The version-bump signal stays
reserved for `confidence`/calibration, exactly as recorded. Malformed emissions are **ignored with a warning**
and degrade to the opaque report (or absent) — never a silent upgrade or a crash.

## Considered options

- **Witness scrapes the `audit-test` Markdown itself.** Rejected — it would make the deterministic gate depend
  on prose parsing and duplicate the judgment the audit skill already made. The skill that *has* the judgment
  emits structured data; Witness reads data, never prose.
- **`audit-test` emits a rolled-up `result`/`label` and Witness trusts it.** Rejected — it moves the theater
  guard from structure to promise. Witness derives the category from raw counts so `deepAudited=0 → unexamined`
  is enforced at the gate, not assumed of the producer.
- **Proven-hollow → `hold`.** Rejected (Kim's call) — a proven lie in the suite is serious, but the code under
  it may be fine; elevating it to `hold` would block shippable releases on a *test* defect and blur `hold`'s
  meaning (red execution). `canary` with a loud rationale is the honest call; the flagged test still gets fixed.
- **Bump to a `witness-evidence-bundle/v1`.** Rejected — the v0 contract deliberately reserved everything this
  needs; bumping now would waste the reservation and muddy the calibration-landed signal.

## Consequences

- **`ship` is reachable — and only the honest way.** The golden self-test's old "`ship` never emitted"
  invariant becomes "`ship` reachable **iff** Playwright PASSED + parsed proven-clean," with explicit rows for
  the theater guard (examined-nothing → canary) and proven-hollow → canary. CI gates on it
  (`witness.mjs --self-test`, `skill-evals.yml`).
- **A new producer→consumer seam** between two skills, pinned by a schema. `audit-test` stays the judgment
  tool; Witness stays the deterministic aggregator. Both remain user-invoked leaves.
- **The growth path narrows to calibration.** With parsed `audit-test` done, the remaining reserved ceilings are
  `confidence`/the calibration loop ([#96](https://github.com/TzolkinB/skills/issues/96), PARKED) and non-Sentinel
  inputs — the triggers for plugin independence ([#99](https://github.com/TzolkinB/skills/issues/99)). Cypress
  ingest is still a separate later increment.
- **Honest limits still carried, not hidden** ([ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)):
  the `ship` bar, the parsed-vs-opaque distinction, advisory-not-blocking, and no-confidence are all stated in
  the skill's own output.
