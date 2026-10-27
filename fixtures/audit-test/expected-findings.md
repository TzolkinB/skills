# Expected findings — audit-test / "rejects overlapping bookings"

Run: `/audit-test fixtures/audit-test/booking.spec.js fixtures/audit-test/booking.js`

## Verdict the skill should reach
🔴 **Confirmed false-confidence** (if it can run the mutation) — or 🟡 **Likely** if no runnable
env is available and it reasons only.

## How it fails (taxonomy)
- **Overmocked / interaction-only** — the test asserts `save()` was called, never that an
  overlap was rejected.
- Compounded by **incidental / focal-unit-never-invoked**: `findOverlapping` is stubbed to
  return `[]`, so the guard the test is named for (`clashes.length > 0` → throw 409) is never
  entered. The assertion is true regardless of whether that guard exists.

## The proof (mutation the skill should run)
Comment out / delete the overlap guard in `booking.js` (the `if (clashes.length > 0) { throw }`
block), run *only this test* → it still passes green. That is the execution proof of false
confidence. Revert immediately after (skill's safety rule; requires a clean git tree).

**Reachability check** ([ADR-0016](../../docs/adr/0016-audit-test-reachability-guard.md)): this is a
unit test whose runner executes `booking.js` from source, so a maximal control mutation is caught
trivially — the harness is source-live and the candidate 🔴 is **confirmed**, not downgraded to 🟡.
(The downgrade path is for app-driven tests hitting a stale build or deployed URL.)

## A real test would
Set `findOverlapping` to return a non-empty array and assert that `svc.book(...)` throws with
`code === 409` — i.e. exercise and pin the rejection behavior, not the mock interaction.

## Boundary notes (what the skill should NOT do)
- Not propose new tests (that's `coverage-review`).
- Not propose deleting the test (that's `prune-tests`) — the fix is to *strengthen* it.

---

# Expected findings — audit-test / notifier fixtures

Two small fixtures lifted from a real qa-review + qa-pass run on a booking-notification PR. In
that run a self-review had called the new tests acceptable; hand-run mutations found them hollow.
Those mutations were done by hand (edit, run jest, restore), **not** by `/audit-test`, so the original
report's "confirmed" label was not skill evidence. The fixtures here were reproduced independently.
Both survive "delete the try/catch" under jest 29 (checked by hand).

## `confirm-booking.spec.js` — "still returns 200 when the notifier throws"
Run: `/audit-test fixtures/audit-test/confirm-booking.spec.js fixtures/audit-test/confirm-booking.js`
- 🔴 **Overmocked.** The module mock never rejects, so the `catch` is never entered; the `200`
  assertion holds with or without it.
- A real test makes the notifier mock reject and asserts the call still returns 200.

## `notify-confirmed.spec.js` — "resolves and logs when the email send rejects"
Run: `/audit-test fixtures/audit-test/notify-confirmed.spec.js fixtures/audit-test/notify-confirmed.js`
- 🔴 **Stale stub / focal path unreached.** `db.rooms` resolves `[]`, so the function returns at the
  empty-rooms guard before `sendEmail`. The test was valid until that guard was added.
- A real test returns a room, then asserts the send was attempted and the error logged.

## `create-booking.spec.js` — "sets status and the staff flag from the caller"
Run: `/audit-test fixtures/audit-test/create-booking.spec.js fixtures/audit-test/create-booking.js`
Second sighting of the family first noted as `purpose: null` → `null`; now a case.
- 🔴 **Constant-input.** Every call passes `staff: false`, so `'pending'` / `false` are what the
  code returns even if it ignores `staff`. Hardcoding both fields survives (checked under jest 29).
- A real test also passes `staff: true` and asserts `confirmed` / `true`.

## Seen in the same run, not yet cases
Guards that survived deletion because no test reached them: a schema rule (`endTime > startTime`),
HTML-escaping of a group name, and an invalid-date guard in a confirmation email. Same
"unreached guard" family as the stale-stub case; add a fixture if one recurs.

Boundary: no case proposes deleting the test or adding new ones.
