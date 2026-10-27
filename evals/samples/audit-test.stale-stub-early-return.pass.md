<!-- RECORDED SAMPLE — a faithful /audit-test run on the stale-stub-early-return fixture. Used by run-eval.mjs
     --dry-run to exercise the grader offline. Representative transcript, not a live capture;
     the mutation outcome it reports was reproduced by hand under jest 29. -->

## audit-test: "resolves and logs when the email send rejects"

**Verdict:** 🔴 Confirmed false-confidence

**How it fails:** Focal unit never reached — the `db.rooms` stub returns `[]`, so `notifyConfirmed` exits at the empty-rooms guard before it calls `sendEmail`. The rejecting mailer is never invoked; the test went stale when that guard was added.

**Proof:** clean tree confirmed → deleted the `try/catch` around `sendEmail` in `notify-confirmed.js` → ran only this test → it **still passed** green → reverted.
Reachability check: the runner executes the source file directly, so the candidate 🔴 is
confirmed, not downgraded to 🟡.

**A real test would:** return at least one room from the `db.rooms` stub, then assert `sendEmail` was attempted and the error was logged.

**Next:** strengthen the test above, then re-run `/audit-test fixtures/audit-test/notify-confirmed.spec.js` — the fix is only real when the mutation dies
