# Shared: the `--digest` evidence card

Loaded from the Output Format of every judgment skill that supports `--digest` — `test-plan`,
`qa-review`, `coverage-review`, `audit-test`, `prune-tests`, `threat-model`, `sentinel`. Defined
**once** here so `--digest` is one shape a reader learns once, not a bespoke short-form per skill.

`--digest` **replaces** the skill's full report with the least output you can act on: what's at risk,
the evidence for it, the one thing to do, and how well that evidence is known. It is a *trim*, never a
summary that adds something the full report didn't say — **a digest may only say less than the report
it replaces.**

The shape is `audit-test`'s single-test entry generalized. That entry was already a four-field card
(Verdict / How it fails / Proof / A real test would = risk / evidence / action / how it's known); this
is the same card with the fields named for what they do, so every skill can emit one.

## The card

```
## <skill> --digest: <scope> — <one-line tally>

**Risk:** <the specific thing that breaks, named — one line>
**Evidence:** <the exact observation: file:line, the assertion, the command and what it did>
**Action:** <one concrete next step, specific enough to start on>
**Confidence:** <Confirmed | Likely | Unexamined> — <what backs it, in a clause>

**Next:** <the routing footer — see next-footers.md>
```

Worked example (`audit-test`, the skill the shape came from):

```
## audit-test --digest: booking.spec.js — 6 triaged · 2 deep-audited · 1 confirmed-hollow

**Risk:** "rejects overlapping bookings" doesn't reject anything — the overlap guard is unprotected.
**Evidence:** commented out `if (clashes.length > 0) { throw }` (booking.ts:34) → `npx jest -t 'rejects overlapping bookings' booking.spec.js` → exit 0, still green → reverted.
**Action:** assert `svc.book(...)` throws with `code === 409`, not that `repo.save` was called.
**Confidence:** Confirmed — the mutation ran and the outcome was observed; reachability cleared.

**Next:** strengthen the assertion, then re-run `/audit-test tests/booking.spec.js` — the fix is only real when the mutation dies.
```

## Rules

1. **One card per finding**, highest risk first. Don't fuse two findings into one card to fit the cap.
2. **At most three cards.** If the full report found more, close with one overflow line —
   `+N more — re-run without --digest for the full report.` Never pad *up* to three: two real
   findings emit two cards.
3. **Nothing found → no cards.** Emit the header line saying so, plus the `Next:` footer, and stop.
   A digest with a manufactured card is worse than no digest.
4. **Evidence is a checkable observation, not a characterization.** `file:line` + the literal
   assertion, the command and its exit code, the uncovered branch from the report you read. "The test
   looks weak" is not evidence — if that's all there is, the finding is `Likely` and the Evidence
   field says what was *read*.
5. **Action is one step, not a plan.** The thing to do next, concrete enough to start on without
   re-reading the full report.
6. **`--digest` wins over `--explain`.** They pull opposite directions; when both are present, emit
   the digest and note `(--explain ignored under --digest)` on the header line.
7. **The header line carries the denominator.** Scope + tally, so a three-card digest never reads as
   "three findings, suite clean" when 40 tests were never examined.

## Confidence — what earns each label

The compression step is where a reasoned finding could quietly acquire the authority of a measured
one. It must not. The labels are this repo's existing provenance vocabulary
([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md),
[ADR-0034](../../docs/adr/0034-proven-confirmed-taxonomy-rename.md)), unchanged:

| Label | Earned by | Never by |
|---|---|---|
| **Confirmed** | Something was **executed or measured this run, and the outcome observed** — a mutation ran and the test's pass/fail was seen; fresh instrumentation reported the line or branch. | Reading carefully. Confidence in a conclusion is not evidence for it. |
| **Likely** | Reasoned from reading the code, test, or description — nothing executed, or execution never reached the target. | — |
| **Unexamined** | Read and triaged, never advanced past the funnel: nothing executed or committed vouches for it. It labels a card only when the finding *is* that nothing here examined it — a hand-off, like `prune-tests`' `Deferred` entry. Otherwise it belongs in the header's **denominator**. | Labelling something clean. Being folded into a clean tally. |

**The digest never upgrades a label.** If the full report says 🟡 Likely, the card says Likely.
Compression is the only thing `--digest` is allowed to do.

Per skill, the strongest label its evidence can support:

| Skill | Ceiling | Why |
|---|---|---|
| `test-plan` | **Likely** | The plan is generated from a description, not graded against a written spec — and the code it plans for may not exist yet. |
| `qa-review` | **Likely** | A static read of source. Nothing runs. |
| `coverage-review` | **Confirmed** *only* for line/branch facts taken from a **fresh** instrumentation report; **Likely** for everything else — static-mode inference, every assertion-quality and edge-case judgment (even in instrumentation mode), and any report older than the source it covers. | A line that executed is not a line that was verified ([ADR-0011](../../docs/adr/0011-coverage-review-prefers-real-instrumentation.md)). |
| `audit-test` | **Confirmed** for 🔴/🟢 (mutation ran, outcome observed, reachability cleared); **Likely** for 🟡 and for ⚠️ baseline-lock; **Unexamined** for triaged-but-never-mutated. | [ADR-0039](../../docs/adr/0039-audit-test-green-requires-execution.md), [ADR-0017](../../docs/adr/0017-audit-test-baseline-lock-suspected.md). |
| `prune-tests` | **Likely** — except a `Confirmed Prune (mutation-backed)` entry (`--audit-evidence`), which carries **Confirmed** | A static economy read. A `Deferred to audit-test` entry is the one card that carries **Unexamined**: deferring it *is* the finding, and the admission that nothing here judged it. A `Confirmed Prune` entry is grounded in a mutation `audit-test` already ran and recorded in its `runs[]` trace, not this skill's own static read. |
| `threat-model` | **Likely** | Reasoning about consequence; it executes nothing and cannot confirm a risk is real. |
| `sentinel` | **The weakest label among the inputs that drove the verdict** (worst-wins). | It composes; it originates no evidence. A PASS carried by four reasoned reads is `Likely`, and a mostly-Unexamined audit tally is reported as such, never as confirmed-solid ([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)). |
