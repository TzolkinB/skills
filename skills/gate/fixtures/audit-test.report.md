# audit-test — false-confidence audit

**Scope:** `tests/e2e/checkout.spec.ts` · 1 test examined

## Finding — `checkout total updates when quantity changes` · 🟡 likely false-confidence

The assertion `expect(total).toBeDefined()` is a Loose Assertion — it passes as long as
*anything* renders, including a wrong total. A mutation that returns a hard-coded `$0.00`
would very likely still pass this test.

**Provenance:** likely (reasoned statically; no mutation run in this pass).
**Suggested assertion:** `expect(total).toHaveText('$42.00')` against the seeded cart.

_This report is carried opaquely by Gate — it is not machine-parsed in v0. A human must read it._
