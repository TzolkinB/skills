<!-- RECORDED SAMPLE — a faithful /audit-test run on the overmocked-notifier-catch fixture. Used by run-eval.mjs
     --dry-run to exercise the grader offline. Representative transcript, not a live capture;
     the mutation outcome it reports was reproduced by hand under jest 29. -->

## audit-test: "still returns 200 when the notifier throws"

**Verdict:** 🔴 Confirmed false-confidence

**How it fails:** Overmocked / focal path never exercised — `jest.mock('./booking-notifier')` auto-mocks the notifier, so it never throws; the `catch` the test is named for is never entered. The `status === 200` assertion is true whether or not the guard exists.

**Proof:** clean tree confirmed → deleted the `try/catch` around `notifyBookingConfirmed` in `confirm-booking.js` → ran only this test → it **still passed** green → reverted.
Reachability check: the runner executes the source file directly, so the candidate 🔴 is
confirmed, not downgraded to 🟡.

**A real test would:** make the notifier mock reject (`mockRejectedValue`) and assert the call still returns 200 and the error was logged.

**Next:** strengthen the test above, then re-run `/audit-test fixtures/audit-test/confirm-booking.spec.js` — the fix is only real when the mutation dies
