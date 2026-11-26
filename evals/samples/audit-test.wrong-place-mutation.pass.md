<!-- RECORDED FAITHFUL SAMPLE (#275, ADR-0056) — the suggested getBooking mutation is rejected as off the
     test's path; the test is proved with a postBooking mutation and kills it. -->

## audit-test: "POST creates the booking and answers 201 with the saved record"

**Verdict:** 🟢 Killed the proposed mutation

**Path check:** the test calls `postBooking` and nothing else. The suggested change in `getBooking` (`route-handlers.js:6`, return status 500) is **not on the test's path**, so I rejected it and did not run it. It would have survived and faked a 🔴.

**Proof:** entry call `postBooking`; mutated `route-handlers.js:14` in `postBooking` (`status: 201` → `status: 200`) → ran only this test → it **failed** on `expect(res.status).toBe(201)` (an assertion failure in this test, not a crash) → reverted. Killed.

**Note:** 🟢 here means it killed this mutation, not that the test is complete.
