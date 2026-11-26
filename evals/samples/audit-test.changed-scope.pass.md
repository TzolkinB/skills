<!-- RECORDED FAITHFUL SAMPLE (#276, ADR-0055) — /audit-test --changed on fixture/audit-test-changed-scope.
     Population is 7 of 12 tests: 2 by changed lines, 3 via whole-file fallback, 2 via changed support file. -->

# audit-test: batch report (--changed, base fixture/audit-test-changed-scope~1)

**Scope:** --changed (7 of 12 tests in 3 files: 2 by changed lines, 3 via whole-file fallback, 2 via changed support file)

- `tests/booking.test.js` — 2 of 7 tests changed (the two added tests); the 5 older tests are out of scope.
- `tests/refund.test.js` — whole-file fallback: only the shared `makeGateway` helper changed, no test body, so all 3 tests count.
- `tests/cancel.test.js` — via changed support file: it imports `tests/helpers/clock.js`, which changed, so both tests count.

Audited 7 · deep-audited 3 (2 🟢 confirmed-solid · 1 🔴 confirmed-hollow) · 4 unexamined

🔴 "saves the booking it creates" (tests/booking.test.js) — overmocked store, confirmed: removing `store.save(booking)` left it green.
