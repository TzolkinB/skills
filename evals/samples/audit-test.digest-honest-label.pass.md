<!-- RECORDED SAMPLE — a faithful /audit-test --digest run on the overmocked-booking
     fixture. Same audit as audit-test.overmocked-booking.pass.md, trimmed to the shared
     card (skills/shared/digest-format.md): Risk / Evidence / Action / Confidence, plus
     the one-line Next: footer. Used by run-eval.mjs --dry-run to exercise the grader
     offline. Representative of the expected output shape, not a live capture. -->

## audit-test --digest: booking.spec.js — 1 triaged · 1 deep-audited · 1 confirmed-hollow

**Risk:** "rejects overlapping bookings" rejects nothing — the `clashes.length > 0` overlap guard in
`booking.js` is unprotected, so removing it ships green.

**Evidence:** clean tree confirmed → commented out the overlap guard in `booking.js` (the
`if (clashes.length > 0) { throw }` block) → `npx jest -t 'rejects overlapping bookings' booking.spec.js`
→ exit 0, still passed → reverted. Reachability cleared: the runner executes `booking.js` from source.

**Action:** assert `svc.book(...)` throws with `code === 409` when `findOverlapping` returns a non-empty
array, instead of asserting `repo.save` was called.

**Confidence:** Confirmed — the mutation ran this session and its outcome was observed.

**Next:** strengthen the assertion above, then re-run `/audit-test fixtures/audit-test/booking.spec.js` — the fix is only real when the mutation dies
