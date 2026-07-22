<!-- RECORDED SAMPLE — a faithful /audit-test run on the overmocked-booking fixture.
     Used by run-eval.mjs --dry-run to exercise the grader offline. This is a
     representative transcript of the expected output shape, not a live capture. -->

## audit-test: "rejects overlapping bookings"

**Verdict:** 🔴 Confirmed false-confidence

**How it fails:** Overmocked / interaction-only — the test asserts `save()` was called
(`expect(repo.save).toHaveBeenCalled()`), never that an overlapping booking was rejected.
Compounded by focal-unit-never-invoked: `findOverlapping` is stubbed to return `[]`, so the
`clashes.length > 0` guard the test is named for is never entered — the assertion is true
regardless of whether that guard exists.

**Proof:** clean tree confirmed → commented out the overlap guard in `booking.js`
(the `if (clashes.length > 0) { throw }` block) → ran only this test → it **still passed**
green → reverted. Reachability check: the runner executes `booking.js` from source, so the
candidate 🔴 is confirmed, not downgraded to 🟡.

**A real test would:** set `findOverlapping` to return a non-empty array and assert that
`svc.book(...)` throws with `code === 409` — exercise and pin the rejection behavior, not the
mock interaction.
