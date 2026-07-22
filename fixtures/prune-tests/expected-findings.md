# Expected findings — prune-tests / cart.spec.js

Run: `/prune-tests fixtures/prune-tests/cart.spec.js`

`prune-tests` proposes a conservative, categorized plan (it does not delete). A correct
run should produce roughly:

## 1. Consolidate / merge (high confidence)
- **`adds two items` + `sums item prices`** — identical behavior contract and matching
  preconditions, tested through the same example. Same scenario class (expected use) → `merge`.

## 3. Over-mocking — reduce internal mocking (medium)
- **`applies tax`** — mocks the internal `tax` collaborator and only asserts `tax.rate()` was
  called, so it verifies the mock rather than the `withTax` math. `rewrite` using a real tax
  collaborator (cheap, in-repo).

## 4. Out-of-sync / stale (high)
- **`returns cents as a formatted string`** — the name and Given/When/Then comment claim a
  `"$X.XX"` string contract, but the assertion checks `typeof === 'number'`. Name/intent no
  longer match the behavior. `rename`/`rewrite`.

## 5. Keep (conservative — anti-over-prune)
- **`empty cart totals zero`** — a real boundary condition; unique signal. `keep`.

## Boundary notes (what the skill should NOT do)
- It should NOT claim any test is confirmed false-confidence — that requires a mutation and is
  `audit-test`'s job (hand off if it smells that way, don't judge it here).
- It should NOT propose *new* tests for missing paths — that's `coverage-review`.
- When scenario equivalence is uncertain, it keeps.
