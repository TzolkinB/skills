# Sentinel run scenario — feat/payments-refund

Run: `/sentinel feat/payments-refund --sacred=src/payments/**`

Sentinel runs no original analysis of its own — it composes the atomic QA skills over a branch and
synthesizes ONE verdict. So this scenario/prompt fixture describes what the sub-skills report over
the branch, and the eval grades Sentinel's **synthesis** of them.

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
