# Rename the `proven` taxonomy to `confirmed` — schema v0.1/v0.2 → v0.2/v0.3

**Status: Accepted (2026-07-22).** Closes [#126](https://github.com/TzolkinB/skills/issues/126): a second hostile
review (ChatGPT round 2) still keyed on the word "proven" — `audit-test`'s 🟢 label, prose like "proven-solid
*against this mutation*", and the schema fields `provenSolid`/`provenHollow` and the derived `label: 'proven'`
in [`audit-test-emission.v0.schema.json`](../../skills/gate/schema/audit-test-emission.v0.schema.json). Same class
of "headline vs. fine print" mismatch [ADR-0033](0033-witness-internal-identifier-rename.md) fixed for `witness://`,
same fix shape: its own ADR, a MINOR schema bump, self-test strings updated deliberately.

## Context

Every hedge attached to "proven" already says the honest thing — "proven-solid *against this mutation* — not a
blanket guarantee the test is fine," "🔴 Proven false-confidence... Factual, execution-proven." A hostile reader
keys on the headline word, not the trailing hedge: "proven" reads as a general, completed claim ("this is
established, full stop") when the actual scope is always narrow — *this one test, against the one mutation we
tried, right now*. The fix isn't a softer synonym; it's a word that doesn't invite dropping the scope in the
first place.

**Scope turned out wider than the issue estimated.** The issue and the roadmap entry both called this "contained
to one skill's contract" (`gate`'s schema). Enumerating the actual blast radius (the same correction ADR-0033
made relative to ADR-0032's estimate) found `proven` is the single vocabulary [ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)
established for evidence provenance, and `audit-test`'s schema is downstream of it, not a fork of it. `sentinel`,
`debug-test`, `prune-tests`, `GLOSSARY.md`, and the project's own top-level docs (`README.md`, `ARCHITECTURE.md`,
`CONTEXT.md`, `PLAN.md`, `REVIEWERS.md`) all quote or restate the same `audit-test` verdict tags — leaving those
saying "proven" while the schema says something else would be a *fresh* inconsistency, not a fix.

**Deliberately left out — a genuinely separate axis, not this issue.** `ask-sentinel` and `audit-orchestrator`
apply the *same three words* (Proven/Likely/Unexamined) to grade the evidence behind a **routing recommendation**
about an external tool ("Tautest **Proven**," "the reachability wall is **Proven**") — a different claim
(confidence in *this skill's advice*) from `audit-test`'s per-test mutation verdict, even though both cite
ADR-0013. Renaming that too would make this a ~10-skill sweep instead of a contained, verifiable one. Filed as
[#131](https://github.com/TzolkinB/skills/issues/131) so the gap is tracked, not silently stale.

## Decision

**1. Word swap: `proven` → `confirmed`, `Proven` → `Confirmed`**, everywhere it names this evidence-provenance
tier (not the ordinary English verb "to prove," which is untouched). `-solid`/`-hollow`/`-clean` suffixes and the
`likely`/`unexamined` neighbors are unchanged — this is a one-word substitution, not a new vocabulary:

- 🟢 `proven-solid` → `confirmed-solid`; 🔴 `proven-hollow` → `confirmed-hollow`; headline `Proven
  false-confidence` → `Confirmed false-confidence`.
- Roll-up label `proven` (PASSED + `label='proven'`, the ship-eligible state) → `confirmed`; compound term
  `proven-clean` → `confirmed-clean`.
- `GLOSSARY.md`'s **Provenance (Proven / Likely / Unexamined)** entry → **Provenance (Confirmed / Likely /
  Unexamined)**, since it's the canonical definition the renamed schema now has to match.

**2. Schema fields, exact-match constants — MINOR bump each, same logic as ADR-0031/0033:**
   - `audit-test-emission`: `provenSolid`/`provenHollow` → `confirmedSolid`/`confirmedHollow`; derived
     `label: 'proven'` → `'confirmed'`. `gate-audit-test/v0.1` → **`gate-audit-test/v0.2`**.
   - `evidence-bundle`: both `label` enums (`evidencePredicate` and `gatePredicate.inputs[]`) carry the same
     value, so they rename too: `gate-evidence-bundle/v0.2` → **`gate-evidence-bundle/v0.3`**.
   - Schema *filenames* are unchanged (ADR-0031/0033 precedent — the family lives in the path, the version in
     `$id`/`schemaVersion`).

**3. Fixture/eval-sample filenames that encode the retired word are renamed** (the same reasoning as ADR-0033
§9: a fixture literally named `audit-test.proven.json` sitting in the tree is exactly the artifact a hostile
reviewer opens next): `skills/gate/fixtures/audit-test.proven.json` → `audit-test.confirmed.json`;
`evals/samples/gate.ship-proven-clean.{pass,fail}.md` → `gate.ship-confirmed-clean.{pass,fail}.md`; eval case id
`ship-proven-clean` → `ship-confirmed-clean`.

**4. In scope for the word swap** (quote or restate the renamed schema/GLOSSARY term, so leaving them stale would
contradict the rename): `skills/gate/**`, `skills/audit-test/**`, `skills/sentinel/SKILL.md`,
`skills/debug-test/reference/flake-mode.md`, `GLOSSARY.md`, `README.md`, `ARCHITECTURE.md`, `CONTEXT.md`,
`PLAN.md`, `REVIEWERS.md`, `docs/audit-test.md`, `docs/sentinel.md`, `docs/prune-tests.md`, `docs/comparisons/tea.md`,
the `gate`/`sentinel`/`audit-test`/`prune-tests` fixtures and eval cases/samples.

**5. Out of scope, left untouched:**
   - **Historical ADRs** (0001–0033) and `CHANGELOG.md` — point-in-time records, same precedent as ADR-0033
     leaving 0028–0031 alone.
   - **`references/witness-*.md`** — locked v0 contract specs and dated hostile-review transcripts; rewriting
     them would rewrite history, not fix a contract.
   - **`ask-sentinel`/`audit-orchestrator`'s routing-evidence "Proven"`** — tracked as [#131](https://github.com/TzolkinB/skills/issues/131), Decision context above.

## Considered options

- **Rename to a new word for the tier** (e.g. "killed"/"survived," borrowing mutation-testing's own vocabulary).
  Rejected — it reads well for the two per-test outcomes but has no natural aggregate ("proven" → ???) without
  inventing a second new word, and it abandons a working `-solid`/`-hollow`/`-clean` structure for no gain over
  a same-shape one-word swap.
- **Rename only the schema constants, leave prose alone.** Rejected — the issue's own motivating quote
  ("proven-solid *against this mutation*") is prose in `audit-test/SKILL.md`, not a schema field; fixing the
  field while leaving the sentence that hostile reviewers actually quoted would miss the point.
- **Also rename `ask-sentinel`/`audit-orchestrator`'s routing-evidence grade now.** Rejected for this pass —
  real scope creep from "one contract" to effectively the whole plugin's vocabulary in one PR; tracked
  separately (#131) so it isn't lost, but verified independently.
- **Bump to v1.0/v1.** Rejected — same reservation as ADR-0031/0033: v1.0 is the calibration/confidence-number
  signal, not a rename.

## Consequences

- **Breaking for any existing bundle/emission** — `gate-audit-test/v0.1` and `gate-evidence-bundle/v0.2`
  producers/consumers no longer validate; intentional, acceptable pre-launch (no released consumers).
- **Verified:** `node skills/gate/gate.mjs --self-test` green with every string deliberately updated (not
  find-replaced blind), `evals/lint.mjs`/`evals/changed.mjs` self-tests green, all touched JSON valid.
- **Residual, tracked separately:** [#131](https://github.com/TzolkinB/skills/issues/131) (`ask-sentinel`/
  `audit-orchestrator` routing-evidence "Proven"), same shape as ADR-0033's residual #124 de-brand sweep.
