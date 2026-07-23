# Extend the `proven` → `confirmed` rename to `ask-sentinel`/`audit-orchestrator`'s routing-evidence label

**Status: Accepted (2026-07-22).** Closes [#131](https://github.com/TzolkinB/skills/issues/131), the residual
scope [ADR-0034](0034-proven-confirmed-taxonomy-rename.md) deliberately deferred.

## Context

ADR-0034 renamed `proven` → `confirmed` everywhere it named `audit-test`'s per-test mutation-verdict
provenance tier, but explicitly carved out `ask-sentinel` and `audit-orchestrator`: they apply the *same
three words* — `Proven`/`Likely`/`Unexamined`, [ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)'s
general evidence-provenance ternary — to a **different claim**: how well-evidenced a *routing
recommendation* about an external tool is ("Tautest **Proven**," "the reachability wall is **Proven**"), not
a per-test mutation verdict. ADR-0034 deferred it to keep that rename contained and independently
verifiable, tracked as #131.

Leaving it unrenamed was always going to be a fresh inconsistency the moment #126 shipped: `audit-test`'s own
schema now says `confirmed`, while the two skills that route *to* it (and the map that ranks it against
external tools) still said `Proven` for what is, at root, the identical "did we run it and observe the
result, or only reason about it" evidentiary question. Same headline-word risk ADR-0034 fixed, just on the
routing-evidence side of the same vocabulary.

## Decision

**1. Same word swap, same scope discipline: `Proven` → `Confirmed`, ordinary-verb "proven"/"provenance"
untouched.** No new vocabulary, no re-litigation of the ternary itself — this issue was never about whether
`Proven`/`Likely`/`Unexamined` is the right three-way split (ADR-0013 settled that), only about the one word
that collided with #126's motivating complaint.

**2. Scope: the two routing skills, the map, and what backs their evals.**
`skills/ask-sentinel/SKILL.md`, `skills/audit-orchestrator/SKILL.md`, `docs/orchestration-map.md`, plus
`evals/cases/audit-orchestrator.json`, the `evals/samples/ask-sentinel.*` and
`evals/samples/audit-orchestrator.*` samples that encode this label, and `fixtures/audit-orchestrator/expected-findings.md`
(the rubric backing that eval case) — found by grep during implementation, not in the issue's original file
list, but load-bearing for the same eval case already in scope.

**3. `docs/orchestration-map.md:168`'s stray lowercase `audit-test proven/likely/unexamined labels` is also
fixed here**, even though it names `audit-test`'s *own* schema label (the #126 axis, not #131's routing
axis) — ADR-0034's file list missed this doc, and leaving one stale lowercase mention sitting three lines
from the routing-evidence fixes this ADR makes would be a fresh, easily-avoidable inconsistency in the same
file this pass is already touching.

**4. Historical ADRs, `CHANGELOG.md`, and the locked `references/witness-ingestible-evidence-audit.md`
contract audit stay untouched** — same precedent ADR-0034 §5 set: point-in-time records, not living docs.
`docs/roadmap.md`'s existing prose describing *what ADR-0034 did* (quoting the retired word) is narrative
history and also stays as written; only a new closure line is appended.

**5. No schema-version impact.** Nothing here is a JSON-Schema field — `ask-sentinel`/`audit-orchestrator`
emit prose, not a structured emission, so there is no `schemaVersion` to bump. This is a pure prose +
eval-fixture sweep, same shape as ADR-0033/0034's non-schema portions.

## Considered options

- **Leave it, since #131 was filed as "someday."** Rejected — the inconsistency it names (schema says
  `confirmed`, the two skills that feed evidence to/from it still say `proven`) doesn't get less true by
  waiting, and the fix is mechanical (no design decision left to make, per the issue's own framing).
- **Re-litigate the ternary's naming while touching it.** Rejected — ADR-0013 already settled
  `Proven`/`Likely`/`Unexamined` as the vocabulary; this is a one-word substitution on top of it, not a
  redesign. Scope discipline matters more here than a marginal wording improvement.
- **A new ADR number vs. amending ADR-0034 directly.** Chose a new ADR (this one) — ADR-0034 already shipped
  and self-tested; editing it after the fact to add scope would blur what was decided *when*, the same
  reasoning that keeps ADR-0032 and ADR-0033 as two documents rather than one edited in place.

## Consequences

- **The `Proven`/`Confirmed` split that used to run along a skill boundary (`audit-test` vs.
  `ask-sentinel`/`audit-orchestrator`) is gone.** One word, one meaning, everywhere it's a label rather than
  the English verb.
- **Verified:** `node evals/run-eval.mjs --self-test cases/ask-sentinel.json` and
  `cases/audit-orchestrator.json` both green (pass-samples pass, negative-samples still correctly fail —
  discrimination intact), `node evals/lint.mjs` clean on both touched `SKILL.md` files, `evals/lint.mjs`
  and `evals/changed.mjs` self-tests green.
- **Residual, none left:** unlike ADR-0034, this pass's grep swept the full repo (excluding historical
  ADRs/CHANGELOG/the locked contract audit) and found no further routing-evidence `Proven` mentions —
  #131 closes clean, no new tracking issue needed.
