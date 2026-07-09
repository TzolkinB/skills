# Sentinel fixtures

Lightweight, per-skill **known-bad inputs** — one tiny fixture per skill that consumes
code/tests. Each fixture is a small, self-contained source and/or test file that deliberately
contains the exact smell its skill is designed to catch, paired with an `expected-findings.md`
naming what a correct run should surface.

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
/qa-review        sentinel/fixtures/qa-review/pricing.js
/coverage-review  sentinel/fixtures/coverage-review/refund.spec.js sentinel/fixtures/coverage-review/refund.js
/audit-test       sentinel/fixtures/audit-test/booking.spec.js sentinel/fixtures/audit-test/booking.js
/prune-tests      sentinel/fixtures/prune-tests/cart.spec.js
/debug-test       sentinel/fixtures/debug-test/checkout.spec.ts
/threat-model     sentinel/fixtures/threat-model/refund.js
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

## Skills with no fixture here (intentionally excluded)

These three skills do **not** consume a code/test fixture, so a known-bad code input does not fit
them:

- **`test-plan`** — consumes a *feature description*, not existing code, and produces a plan.
- **`bug-report`** — consumes a bug observation / repro narrative to file an issue.
- **`sentinel`** — the orchestrator; it consumes the *output of the other skills*, not a raw
  code/test file.

If these gain a fixture later, it would be a scenario/prompt fixture, not a source file.
