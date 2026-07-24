# audit-test's 🟢 requires an executed, failing mutation — cut the reasoning-only escape hatch

**Status: Accepted (2026-07-24).** Closes [#156](https://github.com/TzolkinB/skills/issues/156):
external ChatGPT critique (Tier 2.3 review), finding F2 — verified against source. Supersedes the
"or no plausible green-surviving change exists" clause [ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)
explicitly retained when it renamed the label.

## Context

`audit-test`'s whole thesis is "prove by execution, not reasoning" ([ADR-0001](0001-audit-test-proves-by-execution.md)).
But the 🟢 verdict carried a reasoning-only escape hatch since the skill's early wording, restated
verbatim by ADR-0013 (`SKILL.md:50`, `:76`): a test could earn 🟢 either because a mutation *ran and
failed*, **or** because "no plausible green-surviving change exists" — a judgment call, never executed.

🟢 maps 1:1 to `confirmedSolid` in the `--emit-json` schema, which is exactly what lets `/gate` reach
`ship` ([ADR-0029](0029-witness-parsed-audit-test-graduation.md)). So a model's *inability to devise a
mutation* — pure reasoning, no different in kind from the "AI's say-so" ADR-0001 exists to reject —
could be laundered into an execution-confirmed count. Doubly wrong: "I couldn't think of a mutation
that breaks this" is closer to **hollow/unexamined** (the audit didn't happen) than to **solid** (the
audit happened and the test passed it).

The `runs[]` contract ([ADR-0037](0037-gate-evidence-integrity.md) §3) already required a real command,
mutation, and exit code for every 🟢 record — it never had a matching escape hatch. Only the verdict
prose in `SKILL.md` carried the gap.

## Decision

**Cut the exception.** 🟢 / `confirmedSolid` now requires that a targeted mutation command **actually
ran and failed because of the mutation** — full stop. "No plausible mutation found" is no longer a path
to 🟢:

- If the reasoning happened but nothing ran (or the mutation never reached the code), the test is
  **🟡 Likely** — reasoned only, short of proof.
- If the test never advanced past triage, it stays **Unexamined**.

`SKILL.md:50` (Verdicts) and `SKILL.md:76` (Output Format guidance for a 🟢 write-up) both drop the
"(or no plausible green-surviving change exists)" clause. No schema change: `confirmedSolid` /
`confirmedHollow` / `likelyHollow` / `unexamined` and the `runs[]` shape are unchanged — this is a
narrower *criterion* for assigning 🟢, not a new field.

**Historical note:** [ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md) is left as-written
(it records what was decided in 2026-07, not a live contract) — its retained clause is superseded here,
not edited there.

## Consequences

- **Behavior change, not claims-only.** A test that previously earned 🟢 on reasoning alone (deep-audit
  reached Step 4, no mutation was run, but the auditor judged nothing could survive) now earns 🟡 or
  Unexamined instead. Fewer tests will read `confirmedSolid` per run; that's the fix, not a regression —
  Gate's `ship` graduation was resting on some fraction of never-executed 🟢s.
- No wording elsewhere implied a reasoned 🟢 could carry a `runs[]` record — the run-trace contract
  already forbade it (checked as part of this change: `outcome: "killed"` was always documented as the
  🟢 record's meaning, and "Never fabricate a record" already scoped records to tests actually mutated
  and run). Nothing further to fix there.
- Pairs with a separate finding from the same critique (F1, not itself actioned by this ADR) that flagged
  an over-counted `confirmedSolid` tally as a downstream risk — this is the mechanism that produced it.
