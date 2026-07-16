<!-- RECORDED SAMPLE — a faithful /prune-tests run on the cart.spec.js fixture. Proposes a
     conservative, categorized plan (merge the redundant pair, rewrite the over-mock with a real
     collaborator, rename/rewrite the stale test, keep the boundary case) and deletes nothing. Used
     by run-eval.mjs --dry-run offline. Deliberately stays subtractive: it does NOT claim any test
     is proven false-confidence (that needs a mutation → /audit-test) and does NOT propose new tests
     for missing paths (that's /coverage-review), so the must_not checks read as correctly absent. -->

## Prune Review: cart.spec.js

Tests reviewed: 5   |   Proposed: 1 merge / 2 rewrite / 1 keep

### 2. Consolidate or Rewrite
- **`adds two items` + `sums item prices`** — identical behavior contract (`total([{price:10},{price:5}])` → `15`) tested through the same example; same expected-use scenario class.
  - confidence: high | action: merge

### 3. Over-Mocking (Reduce Internal Mocking)
- **`applies tax`** — mocks the internal `tax` collaborator and only asserts `tax.rate()` was called, so it verifies the mock, not the `withTax` math. A real tax collaborator is cheap and in-repo.
  - confidence: medium | action: rewrite with real collaborator

### 4. Out-of-Sync (Stale) Tests
- **`returns cents as a formatted string`** — the name and Given/When/Then comment claim a `"$X.XX"` string contract, but the assertion only checks `typeof === 'number'`. Name/intent no longer match the behavior.
  - confidence: high | action: rename / rewrite

### 5. Keep (Conservative — Anti-Over-Prune)
- **`empty cart totals zero`** — a real boundary condition with unique signal.
  - action: keep
