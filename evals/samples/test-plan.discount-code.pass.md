<!-- RECORDED SAMPLE — a faithful /test-plan run on the discount-code ticket. Turns the ticket into
     testable acceptance criteria and a layered case list that would FAIL if the behavior broke:
     the edge cases (expiry, minimum, $0 clamp, case/whitespace), the unhappy paths (invalid,
     single-use, no-stacking, concurrency), correct layers, and preconditions. Used by
     run-eval.mjs --dry-run offline. Deliberately specific (no loose "works correctly" criteria) and
     scoped (no tests for creating/administering codes), so the must_not checks read as correctly
     absent. -->

## Test Plan: Apply a Discount Code at Checkout

### Acceptance Criteria
- [ ] A valid active code reduces the subtotal by the stated amount (percentage `SAVE20` → 20% off; fixed `TENOFF` → $10 off).
- [ ] An expired, below-minimum, already-redeemed, or second code is rejected with **no change** to the total.
- [ ] The discounted total is clamped at `$0` and is never negative.

### Happy Path
- [ ] `e2e` — shopper enters a valid code, sees the reduced total, and checks out.
- [ ] `integration` — a valid `SAVE20` on a $100 subtotal persists a $20 reduction.

### Edge Cases
- [ ] `integration` — **expired code**: a code applied at or after its expiry timestamp is rejected. Boundary: exactly at the expiry instant.
- [ ] `integration` — **minimum-order threshold**: rejected below the minimum, accepted at exactly the minimum. Boundary: subtotal == minimum.
- [ ] `unit` — **negative-total clamp**: a fixed-amount code larger than the subtotal yields `$0`. Boundary: discount == subtotal, discount > subtotal.
- [ ] `component` — **case / whitespace**: `save20`, `SAVE20 `, ` SAVE20` all resolve to the same code.

### Unhappy Paths
- [ ] `integration` — **invalid code**: an unknown code is rejected; the total is unchanged (no partial application).
- [ ] `integration` — **already-redeemed single-use code**: the same account redeeming a used code is rejected.
- [ ] `integration` — **no stacking**: applying a second code does not stack discounts.
- [ ] `integration` — **concurrent redemption**: the same single-use code redeemed twice at once — only one succeeds (server-side).

### Test Layers (why)
- `unit` — the discount-amount math (percentage, fixed, the `$0` clamp): pure logic, no I/O.
- `component` — the cart input field: trims/uppercases, renders an inline rejection message.
- `integration` — expiry, minimum, single-use, no-stacking, concurrency: server-side constraints, no browser.
- `e2e` — one thin journey: valid code → reduced total → checkout.

### Preconditions
- Shopper is authenticated (single-use is per account).
- The cart has at least one item and a known subtotal.
- Seed codes exist: an active percentage code, an active fixed code, an expired code, a single-use code already redeemed by the test account.
