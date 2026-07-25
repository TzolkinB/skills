# audit-test certification mode — a sampled clean test with no mutation is Unexamined, not 🟡, and the floor clears iff achievable

**Status: Accepted (2026-07-25).** From [#164](https://github.com/TzolkinB/skills/issues/164), the build half of
[ADR-0038](0038-gate-trust-boundary-and-examined-floor-population.md) Decision 1 part (1b) — the opt-in
`--certify` sample mode. ADR-0038 committed to *building* certification (`sample ∪ suspects`, keep the `audited`
denominator); this ADR records the two **verdict-semantics** calls that build turned up and that ADR-0038
explicitly deferred to "its own spec'd build." Everything mechanical — the flag, the `ceil(floor% × audited)`
sizing, the fixed-seed sha256 hash-and-sort draw, the cost disclosure, the scope self-labelling — lives in the
spec (`audit-test/SKILL.md`, `reference/batch-mode.md`), not here. Leans on
[ADR-0039](0039-audit-test-green-requires-execution.md) (🟢 requires execution) and
[ADR-0035](0035-gate-examined-floor.md) (the examined-floor).

## Context

Certification's whole point is **breadth**: deep-audit a random, floor-sized sample of the triaged tests
**∪** the flagged suspects, so `deepAudited / audited` can clear ADR-0035's examined-floor *legitimately* and a
`ship` recommendation stands on evidence, not on mutating extra suspects. But forcing a mutation onto a
**randomly-sampled, clean-triaged** test — a test triage never flagged — collides with two existing rules in a
way the suspect-only diagnostic funnel never exposed:

1. **The 🟡 rule (ADR-0039).** A deep-audited test where the auditor can devise no breaking mutation is 🟡
   Likely (reasoned, not proven) — *never* 🟢. In diagnostic mode that is exactly right: a test only advances
   past triage because it *smelled*, so "a suspect I couldn't break" is genuine reasoned suspicion. But
   certification advances tests because they were **randomly drawn**, not because they smelled. Routing a
   clean-triaged sampled test to 🟡 would fabricate a suspicion triage never raised — and because any 🟡
   (`likelyHollow`) makes Gate derive **WARNED → `canary`**, a certification run over a *healthy* suite could
   accumulate spurious 🟡s and **block the very `ship` it exists to enable**. The feature would defeat itself.

2. **The floor-clearing guarantee.** If the sample is sized to exactly the floor and drawn as `union ⊇ sample`,
   the floor clears "by construction." But the moment a sampled test is *removed* from `deepAudited` (per the
   fix below), `deepAudited` can fall back under the floor, and a healthy suite misses `ship` by a test or two
   — re-introducing the stuck-at-`canary` outcome the reframe (ADR-0038 1a) set out to retire.

## Decision

### 1. A clean-triaged sampled test with no devisable mutation is **Unexamined**, not 🟡.

The routing key is the **triage smell, not the run mode.** 🟡 keeps its single meaning in both modes —
*a test triage flagged as suspect, reasoned about, but not execution-disproven*:

- **Flagged suspect**, deep-audited, no breaking mutation found → **🟡 Likely** (unchanged; ADR-0039). This
  holds in certification too: a suspect that also happens to be sampled still carries its suspicion signal.
- **Clean-triaged, sampled** (drawn for breadth, never flagged), runnable, but no breaking mutation found →
  **Unexamined**. Not 🟡 (triage raised no suspicion to reason about) and not 🟢 (nothing executed —
  ADR-0039 bedrock). It is honestly "we tried to certify this and could not exercise it," which is a
  *breadth* fact, not a false-confidence signal.
- **Env not runnable** → **🟡** in both modes, unchanged. You cannot certify what you cannot execute; that
  ceiling is ADR-0039, not a certification bug.

The Unexamined case is **named in the human report** ("clean-triaged, no breaking mutation found — worth a
human look"), never silently swallowed — a clean test that resists every mutation is itself a mild smell
(a possibly loose/incidental assertion) and a reviewer should see it. It is *not* a `runs[]` record and
carries no execution claim.

This is why the "healthy suite stuck at `canary`" fear does **not** materialise for a runnable suite: a
genuinely healthy test yields 🟢 (propose the breaking mutation, run the one test, it fails), which counts
toward `deepAudited`. The no-mutation-found case is rare and, for a runnable test, itself suspect — so
routing it to Unexamined removes a false alarm without inflating the floor.

### 2. The floor **clears iff achievable** — adaptive top-up from the same seeded order.

Because Decision 1 can drop a sampled test out of `deepAudited`, sizing to exactly the floor no longer
guarantees clearance. So: draw the floor-sized sample from the seeded order; if Unexamined drop-outs leave
`deepAudited` short of the floor, **continue drawing the next identities from the same deterministic sha256
ordering** — extending the sequence, so reproducibility is untouched — until `deepAudited` clears the floor
**or the triaged pool is exhausted**. Pool-exhausted-and-still-short → honest `canary`.

The guarantee is therefore *conditional and honest*: **certification clears the floor whenever the suite can
be exercised to that breadth, and lands `canary` only when it genuinely cannot** (too many tests resist
mutation, or the env isn't runnable). Counts stay truthful at whatever point the run stops — an interrupted
or pool-exhausted run under-reports rather than claiming breadth it never achieved.

## Considered options

- **Route the clean-sampled no-mutation case to 🟡 (the status quo of ADR-0039, applied uniformly).**
  Rejected — it manufactures suspicion triage never raised and lets a healthy suite's un-mutatable tests
  degrade the run to WARNED/`canary`, defeating certification's purpose. The 🟡 signal would stop meaning
  "reasoned suspicion" and start meaning "the sampler picked a hard-to-break test," polluting the class.
- **Size the sample with fixed headroom (floor% + a buffer) instead of adaptive top-up.** Rejected — the
  buffer is arbitrary (over-spends when there are no drop-outs, can still fall short when there are many),
  where top-up spends exactly what clearance needs and nothing more.
- **Keep "clears by construction" by *not* dropping sampled tests out of `deepAudited`** (i.e. count a
  no-mutation clean test as examined anyway). Rejected — it would re-open the ADR-0039 hole from the other
  side, letting a never-executed test pad the examined count that gates `ship`.

## Consequences

- **🟡 means the same thing in both modes** — "flagged suspect, reasoned, not execution-disproven." The
  routing distinction is triage-cleanness, so no reader has to reason about mode to interpret a verdict.
- **No schema or Gate change.** `confirmedSolid`/`confirmedHollow`/`likelyHollow`/`baselineLock`/`unexamined`
  and the `runs[]` shape are unchanged; certification is a run-mode that produces a truthful tally Gate
  ingests exactly as any other (same precedent as ADR-0035/0038 — no version bump). The Unexamined reroute
  and the top-up are *criteria for assigning existing classes*, not new fields.
- **`ship` stays honestly hard.** A non-runnable suite still cannot reach `ship` (ADR-0039); a runnable
  healthy suite now can, through breadth it actually exercised. Small healthy suites are the *easiest* case
  (a 50% floor over 6 tests needs ~3 🟢s), not the hardest.
- **A latent upside becomes real:** certification mutates clean-triaged tests, so it can catch a hollow test
  the suspect-only funnel would never flag — the 🔴 that makes "random sample" genuine breadth evidence
  rather than floor-padding.
- **The spec, not this ADR, carries the mechanics** — flag name, sizing formula, fixed-seed cross-machine
  sha256 draw, cost disclosure, `scope` self-labelling, and the whole-suite-vs-`--changed` scope note.
