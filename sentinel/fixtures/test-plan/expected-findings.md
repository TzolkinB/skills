# Expected findings — test-plan / discount code at checkout

Run: `/test-plan "$(cat sentinel/fixtures/test-plan/discount-code.md)"` (or paste the ticket).

Unlike the code-consuming fixtures, this is a **scenario/prompt fixture**: the input is a feature
ticket (`discount-code.md`), deliberately rich with edge cases and unhappy paths. A correct plan
turns it into *testable* acceptance criteria and a *layered* case list that would **fail** if the
behavior broke — not a happy-path-only outline. It should surface roughly the following.

## Acceptance criteria (testable, not loose)
- A valid active code reduces the subtotal by the right amount (percentage or fixed).
- An expired / below-minimum / already-redeemed / second code is rejected with **no change** to the total.
- The discounted total is clamped at `$0`, never negative.

## Edge cases the plan MUST surface (a happy-path-only plan misses these)
- **Expired code** — a code applied at/after its expiry timestamp is rejected. Boundary: exactly at expiry.
- **Minimum-order threshold** — rejected when the subtotal is below the minimum; accepted at exactly the
  minimum. Boundary: subtotal == minimum.
- **Negative-total clamp** — a fixed-amount code larger than the subtotal yields `$0`, not a negative
  total. Boundary: discount == subtotal, discount > subtotal.
- **Case / whitespace** — `save20`, `SAVE20 `, ` SAVE20` all resolve to the same code.

## Unhappy paths the plan MUST surface
- **Invalid code** — an unknown code is rejected; the total is unchanged (no partial application).
- **Already-redeemed single-use code** — the same account redeeming a used code is rejected.
- **Second code / no stacking** — applying a second code does not stack discounts.
- **Concurrent redemption** — the same single-use code redeemed twice at once is enforced server-side
  (only one succeeds).

## Layer assignments (should be roughly)
- `unit` — the discount-amount math (percentage, fixed, the `$0` clamp): pure logic, no I/O.
- `component` — the cart input: trims/uppercases, shows an inline rejection message.
- `integration` — expiry, minimum-order, single-use, no-stacking, concurrency: server-side
  constraints / DB, no browser.
- `e2e` — one thin journey: enter a valid code → see the reduced total → check out.

## Boundary notes (what the plan should NOT do)
- **Not happy-path-only** — the value is the edge/unhappy cases; a plan that only lists "enter a valid
  code, total drops" is the green-light failure this skill exists to prevent.
- **Not loose criteria** — "discount works correctly" is un-testable; each criterion must be able to
  fail (name the amount, the rejection, the boundary).
- **Layer discipline** — don't label everything `e2e`; a constraint check that would still pass against
  an API client is `integration`, and pure math is `unit`.
- **Stay in scope** — don't invent tests for creating/administering codes (explicitly out of scope).
