# Expected findings — coverage-review / refund

Run: `/coverage-review sentinel/fixtures/coverage-review/refund.spec.js sentinel/fixtures/coverage-review/refund.js`

The single test is green but only exercises the partial-refund happy path with two
loose assertions. A correct run should flag the gaps below.

## Loose Assertions (should be flagged)
- `expect(result).toBeDefined()` — passes for any non-undefined return; asserts nothing about
  correctness. (See GLOSSARY: Loose Assertion.)
- `expect(result.ok).toBeTruthy()` — never checks `status` (`'partial'` vs `'refunded'`) or the
  computed `remaining`, so wrong arithmetic would still pass.

## Untested Branches / GAPS (should be flagged, roughly by risk)
- **`amount <= 0` throw** — no test that a non-positive amount is rejected.
- **`amount > order.total` throw** — no test for over-refund rejection.
- **`order.status === 'refunded'` branch** — the already-refunded no-op is never exercised.
- **Full-refund boundary (`remaining === 0`)** — the `status === 'refunded'` path at the exact
  boundary is untested; only the `'partial'` side is hit. (See GLOSSARY: Boundary Condition.)
- **`remaining` value** — never asserted, so off-by-one math would slip through.

## Recommended next tests (skill should suggest something like)
1. Refund with `amount <= 0` throws.
2. Refund exceeding `order.total` throws.
3. Refund on an already-`refunded` order returns `{ ok: false }`.
4. Full refund (`amount === order.total`) returns `status: 'refunded'`, `remaining: 0`.
5. Assert the exact shape/values of the returned object, not just its existence.
