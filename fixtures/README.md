# Sentinel fixtures

Lightweight, per-skill **known-bad inputs** — one tiny fixture per skill, paired with an
`expected-findings.md` naming what a correct run should surface. Most are a small, self-contained
source and/or test file that deliberately contains the exact smell its skill is designed to catch.
The skills that don't consume code (`test-plan`, `bug-report`, `sentinel`) instead have a
**scenario/prompt fixture** — a feature ticket, a bug observation, or a branch scenario — carrying
the same role: an input whose correct handling is spelled out in `expected-findings.md`.

## What these are for

1. **Pre-release dogfood verification.** Before shipping a change to a skill, run that skill
   against its fixture and check the output against `expected-findings.md`. If the intended
   finding stops surfacing, the skill regressed. This is a *manual, reasoning-based* check — you
   read the run and confirm it named the planted smell.
2. **Docs / worked examples.** Each fixture doubles as a concrete "here is the kind of input this
   skill flags" example for anyone learning what a skill does.

## What these are NOT

- **Not an automated assertion harness.** Skill output is prose that varies run to run, so there
  is deliberately no exact-output comparison, no snapshot, no CI gate that diffs skill output.
  `expected-findings.md` is a human checklist, not a golden file.
- **Not runnable test suites.** The `.js` / `.ts` / `.spec.*` files are *example inputs* fed to a
  skill, not tests this repo executes. They use a Jest/Vitest/Playwright idiom only because the
  skills' own examples do.

## How to use one

```
/qa-review        fixtures/qa-review/pricing.js
/coverage-review  fixtures/coverage-review/refund.spec.js fixtures/coverage-review/refund.js
/audit-test       fixtures/audit-test/booking.spec.js fixtures/audit-test/booking.js
/prune-tests      fixtures/prune-tests/cart.spec.js
/debug-test       fixtures/debug-test/checkout.spec.ts
/threat-model     fixtures/threat-model/refund.js
```

Then compare the run to that fixture's `expected-findings.md`.

## Fixtures

| Skill | Known-bad input | Planted smell the skill should surface |
|---|---|---|
| `qa-review` | `pricing.js` | Hard-coded prod URL, `new Date()` / `Math.random()` in logic, inline `fetch`, uncontrolled `setTimeout`, fragile string match — untestable in isolation |
| `coverage-review` | `refund.spec.js` + `refund.js` | Loose assertions (`toBeDefined`/`toBeTruthy`) over a happy path; untested guards, error paths, and the full-refund boundary |
| `audit-test` | `booking.spec.js` + `booking.js` | Overmocked "rejects overlapping bookings" — stubs away the overlap, asserts `save()` was called; passes even if the guard is deleted (mutation-provable) |
| `prune-tests` | `cart.spec.js` + `cart.js` | Redundant pair to merge, over-mock of an internal collaborator, a stale name/intent mismatch, and one genuine keeper |
| `debug-test` | `checkout.spec.ts` | Failing Playwright test with a missing `await` on a web-first assertion — caught by Step 2 heuristics, no routing |
| `threat-model` | `refund.js` | Fire-and-forget refund: silent failure, all-refunds blast radius, hard reversibility (email sent, status flipped) |
| `test-plan` | `discount-code.md` *(scenario — a ticket)* | A green-light plan: happy-path-only with loose, un-testable criteria; misses the expiry / minimum / `$0`-clamp edges, the single-use & no-stacking unhappy paths, and layer discipline |
| `bug-report` | `report-export.md` *(scenario — an observation)* | A report that fabricates the sparse input's missing fields — a specific browser/OS/version, an exact `TypeError`, a confident root cause — instead of marking them `Unknown — not provided` (the anti-guess rule) |
| `sentinel` | `branch-scenario.md` *(scenario — a branch)* | Softening a proven-hollow test on a **sacred** path to 🟡 CAUTION ("shippable with notes") instead of the un-overridable 🔴 FAIL the Sacred-Path Override requires |

Three more skills route/detect against a **warm sibling repo** and so keep only an
`expected-findings.md` (no vendored input): `e2e-impact`, `contract-guard`, and
`audit-orchestrator` (targets in `~/projects/`, hand-traced — see each skill's `expected-findings.md`).

## Fixture kinds

- **Code fixture** — a vendored source/test file (the rows above without a *scenario* tag). Feed it to
  the skill directly.
- **Scenario/prompt fixture** — a ticket / observation / branch scenario for the skills that consume a
  description, not code (`test-plan`, `bug-report`, `sentinel`).
- **Warm-sibling fixture** — an `expected-findings.md` that traces against a real sibling repo in
  `~/projects/` (not vendored), used by the repo-context skills (`e2e-impact`, `contract-guard`,
  `audit-orchestrator`).

Every fixture — whichever kind — is now also an executable eval case under
[`evals/`](../evals/) (issue #74): its `expected-findings.md` is the rubric, graded by an
LLM judge that must quote the transcript. The manual dogfood check below still stands; the eval is
the automated regression guard on top.
