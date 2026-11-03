<!-- RECORDED SAMPLE — a faithful /audit-test run on the constant-input-passthrough fixture. Used by
     run-eval.mjs --dry-run offline. Representative transcript, not a live capture; the mutation
     outcome it reports was reproduced by hand under jest 29. -->

## audit-test: "sets status and the staff flag from the caller"

**Verdict:** 🔴 Confirmed false-confidence

**How it fails:** Constant-input — every call uses `staff: false`, so the expected `'pending'` and `false` are exactly what the code returns if it ignores `staff`. The assertions are true regardless of the branch; the admin path (`staff: true` → confirmed) is never exercised.

**Proof:** clean tree confirmed → hardcoded `status` to `'pending'` and `createdByStaff` to `false` in `create-booking.js` → ran only this test → it **still passed** green → reverted. Reachability check: the runner executes the source directly, so the candidate 🔴 is confirmed, not downgraded to 🟡.

**A real test would:** also call with `staff: true` and assert `status === 'confirmed'` and `createdByStaff === true`.

**Next:** strengthen the test above, then re-run `/audit-test fixtures/audit-test/create-booking.spec.js` — the fix is only real when the mutation dies
