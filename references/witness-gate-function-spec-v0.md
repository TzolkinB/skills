# Witness categorical gate-function spec — v0 (LOCKED)

> Provenance: resolution of wayfinder ticket #103 (map #98, effort `witness-map`), 2026-07-17.
> Decided in a `/grilling` session against the locked contract asset this ticket blocked on:
> `references/witness-evidence-bundle-contract-v0.md` (#102), with `#96` (TEA ↔ Witness) as the
> category-alignment design input.
>
> This is a **locked spec on paper** — the decision rule + the gate-entry shape — the deliverable
> #103 owes. It is NOT gate code. The formal ADR + the build happen at the map's destination via
> `/to-spec`. Scope guardrails carried from the map: **Playwright JSON only**; `audit-test` is the
> credible-today-but-opaque Sentinel input; the numeric score + calibration loop are deferred/PARKED
> — the gate **reasons over categorical facts, it does not compute a number.**

---

## The one-sentence spec

The gate function reads a locked evidence bundle (contract v0, `entries[]`) and derives one release
decision — **`ship | canary | hold`** — by taking the **most conservative** category proposed across
the stage entries (an ordinal `hold > canary > ship` min, never a weighted sum), then **appends its
reasoning back into the bundle** as a `witness.local/gate/v0` entry that shows its work; it is
**advisory** (it reports, it never fails the build) and **carries no number anywhere** — re-introducing
`confidence` requires a schema-version bump, which is the signal that calibration has landed.

---

## Locked decisions (the grilling trail)

| # | Fork | Decision |
|---|------|----------|
| Q1 | Advisory or blocking | **Advisory / report-first.** The gate emits `decision` + rationale and posts it; it **never fails the build** in v0. Blocking is a documented **opt-in future escalation** (mirrors ADR-0026's `--live` report-first posture). Surfaced here because it proved inseparable from the decision rule — an advisory gate can be maximally opinionated in its *recommendation* precisely because it stops no one, which is what lets `hold`/`canary` stand without false precision. |
| Q2 | Category vocabulary | **Independent `ship / canary / hold`**, with a published **1:1 mapping** to TEA's `PASS / CONCERNS / FAIL`. `ship/canary/hold` is *action-oriented* (a deploy decision — "canary" encodes progressive rollout) and stays plugin-neutral (`witness://`, coupled to neither `sentinel` nor TEA). Interop with TEA is *orchestration, not code* (#96), so a documented map suffices. **`WAIVED` maps to nothing in v0** — it *is* the human-override / calibration feed, which is the exact capability that earns Witness plugin independence (#99). |
| Q3 | Playwright axis | `FAILED → hold` · `WARNED (flaky>0) → canary` · `PASSED → ship-baseline`. **WARNED → canary** (not ship-with-note) because flakiness is a *trust* defect, and trust is Witness's whole thesis — burying it under a note would suppress the one signal Witness exists to raise. |
| Q4 | Opaque `audit-test` | **Presence floors the decision at `canary`** with a `human-must-read` rationale. The gate holds credibility evidence it cannot machine-read, so it **refuses to certify a clean `ship`** while that evidence sits unexamined in the bundle. This is what keeps v0 from being theater (a mere reprint of Playwright's exit code). |
| Q5 | Combination + absent-audit fork | **Worst-wins** — each axis proposes a category; the gate takes the ordinal min (`hold > canary > ship`). **Absent `audit-test` also floors at `canary`** (`no-credibility-evidence: trust unverified`), so there is **no perverse "run less, grade better" incentive** and caveat #1 (theater without stages 3–5) is structurally enforced. **Consequence: `ship` is UNREACHABLE in v0** — reserved, defined, and unlocked only when `audit-test` emits a *parsed* verdict (the B→A graduation, out of this map's scope). |
| Q6 | Gate-entry shape | A `witness.local/gate/v0` in-toto Statement **appended into the same bundle's `entries[]`** (evidence + verdict in one self-contained file — no artifact to hunt for). Predicate = `decision` · `inputs[]` (each aggregated entry + what it *proposed* → the worst-wins arithmetic is auditable from the bundle alone) · `rationale[]` (strings). `inputs[]` references entries by `stage` name in v0; a stable per-entry `id` arrives *with* multiple-entries-per-stage, not before. |
| Q7 | Honesty guard | Four mechanisms, three structural + one convention: **(1) category-in/category-out** — the gate reads `verdict.result` (already categorical) + presence/opacity, never `metrics[]` numbers; **(2) ordinal aggregation** — worst-wins is a lattice-meet, not #96's cardinal `Σ risk × credibility × execution`; **(3) schema forbids numeric fields** in the gate predicate (`additionalProperties:false`, all enum/string/array) so a validator rejects a smuggled number; **(4)** rationale is categorical prose (names the rule that fired, never a magnitude). |

---

## Category vocabulary & TEA alignment (Q2)

| Witness (native, `witness://`) | ⇄ | TEA `trace` gate | Meaning |
|---|---|---|---|
| `ship`   | ⇄ | `PASS`     | Release. **Unreachable in v0** (see Q5). |
| `canary` | ⇄ | `CONCERNS` | Release cautiously with monitoring / a human gate. |
| `hold`   | ⇄ | `FAIL`     | Do not release. |
| *(none in v0)* | ⇄ | `WAIVED` | Human override with an evidence→decision→reason trail — **the calibration feed** (#96, PARKED). Its arrival is the #99 plugin-independence trigger. |

The mapping is documentation only — Witness emits its own vocabulary. Nothing in v0 is built against
TEA's enum.

---

## The decision rule (Q3–Q5)

### Axes (v0)

Two categorical inputs, each independently proposing a category:

1. **Playwright axis** — from the `playwright` entry's `verdict.result` (mechanical, per contract v0):

   | `verdict.result` | proposes |
   |---|---|
   | `FAILED` (`stats.unexpected > 0`) | `hold` |
   | `WARNED` (`stats.flaky > 0`)       | `canary` |
   | `PASSED`                           | `ship` |

2. **Credibility axis** — from the `audit-test` entry's *presence & opacity* (no parsed verdict in v0):

   | `audit-test` entry | proposes | rationale tag |
   |---|---|---|
   | present, opaque | `canary` | `human-must-read` |
   | absent          | `canary` | `no-credibility-evidence` |

### Aggregation — worst-wins (ordinal min)

`decision = min over axes, under  hold < canary < ship` (i.e. the *worst* proposed category wins).
This is an ordinal meet, **not** a weighted sum — see honesty guard (2).

### Assembled v0 truth table

| Playwright | `audit-test` | → decision | governing rule |
|---|---|---|---|
| `FAILED` | any / absent | **`hold`** | execution failed — dominates all |
| `PASSED` or `WARNED` | present (opaque) | **`canary`** | credibility axis floors at canary (`human-must-read`) |
| `PASSED` or `WARNED` | absent | **`canary`** | credibility axis floors at canary (`no-credibility-evidence`) |
| *(no `playwright` entry)* | any | **`hold`** | no execution evidence |
| *(empty bundle)* | — | **`hold`** | nothing to attest |
| — | — | **`ship` → unreachable in v0** | reserved; unlocked by a *parsed* `audit-test` verdict (B→A graduation) |

Unrecognized future entries are **ignored for the decision** but still listed in `inputs[]`
(forward-compat: ignore-unrecognized, per contract v0).

> **Why `ship` is intentionally unreachable in v0.** `ship` means "execution passed **and** the tests
> are machine-confirmed trustworthy." v0 cannot machine-read trustworthiness (`audit-test` is opaque),
> so it legitimately cannot certify `ship`. The ceiling of `{canary, hold}` is the gate being honest
> about the boundary of what it can prove today — and it makes the growth path legible: parsed
> `audit-test` emission is precisely what unlocks the top grade. This mirrors how contract v0 *reserves*
> `confidence`/DSSE (defined, no producer yet).

---

## The gate-entry shape (Q6)

Appended as the final element of the bundle's `entries[]`. Exactly **one** gate entry per bundle
(one bundle = one `subject` = one decision).

```jsonc
{
  "_type": "https://in-toto.io/Statement/v1",
  "predicateType": "https://witness.local/gate/v0",   // versioned; witness:// namespace
  "subject": [],                                       // shared at bundle top level (contract Q4)
  "predicate": {
    "stage": "gate",                                   // gate is just another stage entry (contract Q1)
    "producer": {
      "id": "witness://gate@0.x",
      "startedOn": "2026-07-17T10:05:00Z",
      "finishedOn": "2026-07-17T10:05:00Z"
    },
    "decision": "canary",                              // ship | canary | hold
    "inputs": [                                        // aggregated entries + what each PROPOSED
      { "stage": "playwright", "result": "PASSED", "proposed": "ship" },
      { "stage": "audit-test", "opaque": true,     "proposed": "canary" }
    ],
    "rationale": [                                     // human-readable, one line per governing rule
      "playwright PASSED → ship-baseline",
      "audit-test present but opaque → floor at canary (human must read the report)",
      "worst-wins over {ship, canary} → canary"
    ]
    // NO confidence / score / weight / numeric field anywhere (honesty guard 3).
  }
}
```

Field notes:

- **`inputs[]` shows its work** — recording each entry's *proposed* category makes the worst-wins
  arithmetic reconstructable from the bundle alone. This is a deliberate **transparency differentiator**:
  #96 records that TEA's gate algorithm is *not* transparent; Witness's is, by construction.
- **`inputs[].stage`** references the aggregated entry by stage name — unambiguous in v0 (distinct
  stages). A stable per-entry `id` is reserved for when multiple-entries-per-stage arrives.
- **`inputs[]` per-axis keys** carry only categorical facts: `result` (the entry's `verdict.result`),
  `opaque` (boolean presence-without-parse), and `proposed` (the category this input contributed).
  No counts, no scores.
- **`rationale[]`** is the legible explanation; the machine-readable trace lives in `inputs[]`.
  No structured rule-objects in v0 — legibility over ceremony (contract Q2).

---

## Honesty guard (Q7) — how the number is structurally excluded

| # | Mechanism | Kind |
|---|---|---|
| 1 | **Category-in, category-out.** The gate consumes `verdict.result` (categorical) + presence/opacity. It **never reads `metrics[]` numbers** and never thresholds on a count. The one numbers→category step (Playwright `stats` → `result`) lives in the **ingest adapter** as a mechanical fact-restatement, not in the gate. No numeric input reaches the gate ⇒ nothing to build a score from. | structural |
| 2 | **Ordinal aggregation, not cardinal.** Worst-wins is a lattice-meet over `hold < canary < ship` — an ordinal min. It is the deliberately number-free stand-in for #96's `Σ (risk) × (credibility) × (execution)`, which *is* a real number and belongs to the deferred calibrated future. Choosing the meet over the product is itself an honesty decision. | structural |
| 3 | **Schema forbids numbers.** `witness.local/gate/v0` schema is `additionalProperties:false`; every field is enum/string/array. A validator **rejects** a bundle whose gate predicate carries a numeric field. Re-adding `confidence` requires a **schema-version bump** — which is the *signal* that the calibration loop has landed (mirrors contract Q6). | structural |
| 4 | **Rationale is categorical prose.** Each line names the *rule that fired* ("audit opaque → floor at canary"), never a magnitude ("85% confident"). | convention |

---

## Reserved (documented, built by nobody in v0)

Every one is a non-breaking future addition the schema already tolerates (versioned `predicateType` +
ignore-unrecognized + `annotations`):

- **`ship` as a reachable decision** — unlocked by a *parsed* `audit-test` verdict (B→A graduation).
- **Blocking mode** (Q1) — an opt-in escalation that fails the build on `hold`; mirrors ADR-0026 `--live`.
- **`WAIVED`** (Q2) — the human-override / calibration feed; the #99 plugin-independence trigger.
- **`confidence` / any numeric field** (Q7) — arrives *with* the calibration loop that earns it (#96, PARKED); its arrival is signalled by a schema-version bump.
- **Risk-weighted aggregation** (#96) — TEA `P0–P3` weights turning worst-wins into a weighted product; a new cardinal path, deferred with calibration.
- **Per-entry `id` references in `inputs[]`** — arrive with multiple-entries-per-stage.

---

## Out of scope for this ticket (recorded, not decided here)

- **Where the decision is posted** (PR comment, check-run annotation, CLI stdout) — a reporting concern
  for the Gate skill / `/to-spec`, not the gate function.
- **The rendered view** of the bundle / decision (pretty Markdown) — a presentation concern (contract v0
  already routed this to the Gate/reporting skill).
- **The B→A graduation** (parsed `audit-test` emission that unlocks `ship`) — the next Witness effort,
  beyond this map's Playwright-only destination.

---

## Prior-art lineage (what each decision borrowed)

- **in-toto Test Result predicate** — `PASSED/WARNED/FAILED` frame reused as the Playwright-axis input.
- **in-toto Statement** — the gate entry is a proper Statement (`_type`/`predicateType`/`predicate`),
  so it rides in `entries[]` uniformly and survives the JSON-Lines migration (contract Q3).
- **SLSA** — `producer.id` + `startedOn/finishedOn` on the gate entry (who/when produced the decision).
- **TEA `trace` gate** — the `PASS/CONCERNS/FAIL/WAIVED` categories, mapped-to not adopted (Q2); and the
  observation that TEA's gate is *opaque*, which motivated Witness's `inputs[]`-shows-its-work transparency.
- **CycloneDX (CDXA) `confidence`** — the number Witness deliberately does **not** emit until calibrated.

---

## Ready for `/to-spec`

With #103 resolved, the four load-bearing decisions the destination named are all locked:

1. **Architecture** — Gate stage inside Sentinel, not a separate plugin (#99).
2. **Evidence-bundle contract** — v0 pinned (#102).
3. **Gate function** — this spec (#103): decision rule + gate-entry shape.
4. **Advisory vs blocking** — advisory / report-first (Q1 here).

The first honest vertical is **sliced by the accumulated scope decisions** (Playwright-only ingest;
`audit-test` opaque; `ship` unreachable; no `confidence`; no calibration; advisory). The verdict is
**build** — none of the decisions warranted the destination's "don't build yet" degrade. The next step
— assembling these four assets into a formal spec via `/to-spec` — is on the **main flow**, beyond this
map's threshold.
