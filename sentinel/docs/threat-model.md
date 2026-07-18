# threat-model — if this change is wrong, what breaks in production?

> **Agent instructions:** [`skills/threat-model/SKILL.md`](../skills/threat-model/SKILL.md) · **Run:** `/threat-model booking.ts`

## What it does

`threat-model` answers a question neither [`qa-review`](./qa-review.md) nor [`coverage-review`](./coverage-review.md) asks. Those ask *can I test this* and *did the tests verify it*. This asks: **if this change is wrong, what actually happens, to whom, and would anyone find out?** Code can be perfectly testable and thoroughly tested and still have a bad blast radius when it fails — this skill looks at consequence, not coverage.

For everything a change touches — data writes, external systems, downstream dependents — it works four axes: failure mode, blast radius, detectability, and reversibility. It ranks by impact weighted by *how long a failure would go unnoticed*, so a silent failure outranks a loud one at the same impact — loud failures get fixed fast, silent ones run in production. It's reasoning, not verification: it can't confirm a risk is real and it flags reversibility as an open question rather than inventing a rollback plan it can't see.

## When to use it

- Before shipping something risky, when you want the "what could go wrong in prod" view on its own.
- You want to reason about blast radius and detectability independent of whether the change is tested.

## When *not* to use it

- **You want testability smells** (hard-coded values, non-determinism) → [`qa-review`](./qa-review.md). threat-model deliberately doesn't re-flag those.
- **You want coverage gaps** → [`coverage-review`](./coverage-review.md).
- **You want a shippability verdict** → [`sentinel`](./sentinel.md). threat-model is intentionally *not* in the `/sentinel` chain — it answers a different question and is called on its own.

## Prerequisites

Just Claude Code — it reads the change or diff and reasons about consequence. It runs nothing, prescribes no rollback it can't see, and adds no network calls of its own.

## Worked example

Fixture: [`fixtures/threat-model/`](../fixtures/threat-model/) ([expected findings](../fixtures/threat-model/expected-findings.md)).

```
/threat-model sentinel/fixtures/threat-model/refund.js
```

The change makes refunds "fire-and-forget": `paymentGateway.refund(...)` is no longer awaited or error-checked, yet the order is marked `refunded` and the customer is emailed regardless. A correct run first enumerates what it touches (orders table, payment gateway, email service, downstream reporting) and then ranks the top risk **HIGH** for its *low detectability*:

- **Silent refund failure with recorded success** — the gateway call fails, money is never returned, but the DB says success and the confirmation email already went out.
- **Blast radius:** every refund path, all customers, plus reporting/reconciliation that trusts order status.
- **Detectability:** silent — found only by manual reconciliation or a customer complaint. This is why it outranks a louder, same-impact failure.
- **Reversibility:** hard — the email is sent and the status flipped; unwinding is money movement, not a code rollback.

It raises open questions (is this flag-gated? what reconciles gateway refunds against status today?) without answering them, and it doesn't re-flag the testability smells or invent a rollback plan.

## Where it fits

Runs *independently* of the [`sentinel`](./sentinel.md) chain — "what breaks in production" is orthogonal to shippability, so `/sentinel` never calls it. Pair it with [`qa-review`](./qa-review.md) on a risky change: qa-review asks *can I test this*, threat-model asks *what happens if it's wrong*.

## Anti-patterns

- **Ranking by probability instead of detectability × impact.** A silent failure you think is unlikely still outranks a loud one — because if it does happen, nobody notices.
- **Inventing a rollback plan.** Reversibility is raised as a question; the skill can't see your deploy pipeline.
- **Manufacturing risk to fill the template.** If a change touches nothing with real blast radius (an isolated internal script), say so.
- **Re-flagging testability.** Non-determinism and hard-coded values are [`qa-review`](./qa-review.md)'s scope, not this one's.
