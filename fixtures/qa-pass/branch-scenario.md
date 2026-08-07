# QA Pass run scenario — payments-refund

Run: `/qa-pass fixture/sentinel-payments-refund --sacred=src/payments/**`

QA Pass runs no original analysis of its own — it composes the atomic QA skills over a branch and
synthesizes ONE verdict. This document is the **spec** the real fixture branch was built from — for
the `--dry-run`/`--self-test` tiers it still just describes what the sub-skills should report, graded
against the recorded samples in `evals/samples/`. For `--live` (#210), the branch it describes is
materialized for real at `fixture/sentinel-payments-refund` (real commits, a real merge-base with
`main`, a runnable `node --test` project) — `evals/cases/qa-pass.json`'s `fixture_ref` checks that
branch out into the isolated worktree, so the live agent derives the findings below itself instead of
being handed them in the prompt.

## The branch
- Changed: `src/payments/refund.js` + `src/payments/refund.test.js`, and
  `src/reports/export.js` + `src/reports/export.test.js`.
- Designated sacred path for this run: `src/payments/**`.

## What the sub-skills report
- **audit-test --changed** (the False-Confidence Audit) proves ONE test hollow:
  🔴 `"refunds the full charge"` (`src/payments/refund.test.js`) — a mutation removed the
  refund-amount guard and the test stayed green (confirmed false-confidence), **paired to
  `src/payments/refund.js`**. The other 5 changed tests are Unexamined (triaged-clean, not confirmed).
- **coverage-review** — one loose assertion in `src/reports/export.test.js`; no unhandled boundary on
  the sacred payments logic.
- **qa-review** — a hard-coded URL in `src/reports/export.js` (testability).
- **debug-test** — no failing tests in the change.
