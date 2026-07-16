<!-- RECORDED SAMPLE — a faithful /coverage-review run on the refund fixture (refund.spec.js +
     refund.js). One green happy-path test with two loose assertions; every guard, error path, and
     the full-refund boundary is untested. Static mode (the fixture ships no coverage output). Used
     by run-eval.mjs --dry-run offline; a representative transcript, not a live capture.
     Deliberately ADDITIVE — recommends tests to add, never proposes deleting a test and never
     mutates or runs the suite — so the must_not checks read as correctly absent. -->

## Coverage Review: refund.js
**Coverage source:** static inference (no coverage output found)

### Covered Behaviors
- Partial-refund happy path — `processRefund({ total: 100, status: 'paid' }, 40)` runs and returns a result.

### Loose Assertions
- `expect(result).toBeDefined()` — passes for any non-undefined return; asserts nothing about correctness.
- `expect(result.ok).toBeTruthy()` — never checks `status` (`'partial'` vs `'refunded'`) or the computed `remaining`, so wrong arithmetic would still pass.

### GAPS (Not Tested)
- [ ] **HIGH** `amount <= 0` throw — no test that a non-positive amount is rejected.
- [ ] **HIGH** `amount > order.total` throw — no test for over-refund rejection.
- [ ] **MEDIUM** already-`refunded` branch — the `{ ok: false }` no-op is never exercised.
- [ ] **MEDIUM** full-refund boundary (`remaining === 0`) — only the `'partial'` side is hit; the `status: 'refunded'` path is untested.
- [ ] **LOW** `remaining` value — never asserted, so off-by-one math would slip through.

### Untested Branches
- Line 5: `if (amount <= 0) throw` — untested.
- Line 8: `if (amount > order.total) throw` — untested (over-refund rejection).
- Line 11: `if (order.status === 'refunded')` — untested.
- Line 16: `remaining === 0 ? 'refunded' : 'partial'` — only the `'partial'` side is exercised.

### Recommended Next Tests
1. Refund with `amount <= 0` throws.
2. Refund exceeding `order.total` throws.
3. Refund on an already-`refunded` order returns `{ ok: false }`.
4. Full refund (`amount === order.total`) returns `status: 'refunded'`, `remaining: 0`.
5. Assert the exact shape/values of the returned object, not just its existence.
