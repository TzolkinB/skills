<!-- RECORDED SAMPLE — a faithful /audit-test --emit-json run on the overmocked-booking fixture,
     grading whether the runs[] trace it writes (#140, ADR-0037 B2) is an honest record of the
     one mutation it actually ran, not a restated verdict or a fabricated extra record.
     Used by run-eval.mjs --dry-run to exercise the grader offline. This is a representative
     transcript of the expected output shape, not a live capture. -->

## audit-test: "rejects overlapping bookings"

**Verdict:** 🔴 Confirmed false-confidence

**How it fails:** Overmocked / interaction-only — the test asserts `save()` was called
(`expect(repo.save).toHaveBeenCalled()`), never that an overlapping booking was rejected.
Compounded by focal-unit-never-invoked: `findOverlapping` is stubbed to return `[]`, so the
`clashes.length > 0` guard the test is named for is never entered — the assertion is true
regardless of whether that guard exists.

**Proof:** clean tree confirmed → commented out the overlap guard in `booking.js`
(the `if (clashes.length > 0) { throw }` block) → ran only this test with
`npx jest -t 'rejects overlapping bookings' booking.spec.js` → it **still passed** green
(exit 0) → reverted. Reachability check: the runner executes `booking.js` from source, so the
candidate 🔴 is confirmed, not downgraded to 🟡.

**A real test would:** set `findOverlapping` to return a non-empty array and assert that
`svc.book(...)` throws with `code === 409` — exercise and pin the rejection behavior, not the
mock interaction.

Wrote the emission alongside this report to `/tmp/audit-test-emission.json` — one `runs[]`
record for the one test a mutation actually ran against, matching the Proof above exactly:

```json
{
  "schema": "gate-audit-test/v0.3",
  "producer": "audit-test",
  "scope": "fixtures/audit-test/booking.spec.js",
  "audited": 1,
  "deepAudited": 1,
  "confirmedSolid": 0,
  "confirmedHollow": 1,
  "likelyHollow": 0,
  "baselineLock": 0,
  "unexamined": 0,
  "runs": [
    {
      "test": "booking.spec.js::rejects overlapping bookings",
      "mutation": "removed the clashes.length > 0 guard in booking.js",
      "command": "npx jest -t 'rejects overlapping bookings' booking.spec.js",
      "outcome": "survived",
      "exitCode": 0
    }
  ]
}
```
