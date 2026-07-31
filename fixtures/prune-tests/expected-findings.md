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

## checkout.spec.js + `--audit-evidence` (#192)

Fixture: `checkout.spec.js` (two hand-off candidates, no redundancy/over-mock/staleness — see the
file's own comments) + `checkout.audit-evidence.json` (a `gate-audit-test/v0.3` emission: `processes
payment` is `confirmedHollow` with a matching `runs[]` record; `applies discount code` is
`likelyHollow`, with no `runs[]` record).

### Baseline — `/prune-tests fixtures/prune-tests/checkout.spec.js` (no flag)
Both tests are loose/incidental, not redundant, over-mocked, or stale, so both land under **Deferred
to audit-test** and nowhere else. No `Confirmed Prune` section appears — the flag was never given.

### With evidence — `/prune-tests fixtures/prune-tests/checkout.spec.js --audit-evidence=fixtures/prune-tests/checkout.audit-evidence.json`
- **`processes payment`** — promoted to **Confirmed Prune (mutation-backed)**. The evidence's `runs[]`
  record names this exact test `confirmedHollow` (`outcome: "survived"`): the mutation removed the
  `amount` argument from `gateway.charge(amount)` and the test still passed. `confidence: high`,
  `action: remove`.
- **`applies discount code`** — stays under **Deferred to audit-test**, unchanged. The evidence marks
  it `likelyHollow`, not `confirmedHollow`, and — structurally — a `likelyHollow` verdict never gets a
  `runs[]` record to match against, so there is nothing here that could promote it.

### Boundary notes (what the skill should NOT do, #192)
- It should NOT promote `applies discount code` — a `likelyHollow` verdict is reasoned-only, not
  execution-confirmed, and must never be treated the same as `confirmedHollow`.
- It should NOT claim it ran or reasoned about a mutation itself — the mutation is `audit-test`'s
  evidence, reported via `--audit-evidence`, not this skill's own analysis.
- It should NOT drop the `Confirmed Prune` promotion to the same confidence as a static finding —
  it is this skill's one **Confirmed**-grade entry, not `Likely`.
