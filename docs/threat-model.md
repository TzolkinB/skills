# threat-model — if this change is wrong, what breaks in production?

> **Agent instructions:** [`skills/threat-model/SKILL.md`](../skills/threat-model/SKILL.md)
>
> **Run:** `/threat-model booking.ts`

## What it does

`threat-model` answers a question that neither [`qa-review`](./qa-review.md) nor [`coverage-review`](./coverage-review.md) asks. Those ask: is this testable, and did the tests verify it? This skill asks a different question: if this change is wrong, what actually happens, to whom, and does anyone find out? Code is sometimes perfectly testable and thoroughly tested, and still carries a bad blast radius — how much breaks — when it fails. This skill looks at consequence, not coverage.

For everything a change touches — data writes, external systems, downstream dependents — the skill works four axes: failure mode, blast radius, detectability, and reversibility. It ranks each risk by impact, weighted by how long a failure stays unnoticed. A silent failure outranks a loud one at the same impact. A loud failure gets fixed fast. A silent one runs in production, unfixed. This is reasoning, not verification. The skill does not confirm that a risk is real. It flags reversibility as an open question, instead of inventing a rollback plan it has no way to see.

## When to use it

| Your situation | Where to go |
| --- | --- |
| Before you ship something risky, and you want the view of what breaks in production, on its own | **`/threat-model booking.ts`** — this page |
| You want to reason about blast radius and detectability on their own, separate from whether the change is tested | **`/threat-model`** |
| You want testability smells — hard-coded values, non-determinism | [`qa-review`](./qa-review.md) instead — `threat-model` does not re-flag those |
| You want coverage gaps | [`coverage-review`](./coverage-review.md) instead |
| You want a QA judgment read across a branch | [`qa-pass`](./qa-pass.md) instead |
| You want the actual ship, canary, or hold decision | `gate` instead — `threat-model` stays out of the `/qa-pass` chain by design and answers a different question |

## Prerequisites

Only Claude Code. `threat-model` reads the change or diff and reasons about consequence. It runs nothing. It prescribes no rollback it has no way to see, and it adds no network calls of its own.

## Worked example

Fixture: [`fixtures/threat-model/`](../fixtures/threat-model/) ([expected findings](../fixtures/threat-model/expected-findings.md)).

```
/threat-model fixtures/threat-model/refund.js
```

The change makes refunds _fire-and-forget_: `paymentGateway.refund(...)` is no longer awaited or checked for errors. Yet the order is still marked `refunded`, and the customer still gets an email. A correct run first lists what the change touches — the orders table, the payment gateway, the email service, downstream reporting. It then ranks the top risk **HIGH**, because of its low detectability:

- **Silent refund failure with recorded success** — the gateway call fails, and the money never comes back. But the database says success, and the confirmation email already went out.
- **Blast radius:** every refund path, all customers, plus the reporting and reconciliation that trusts order status.
- **Detectability:** silent. Only manual reconciliation or a customer complaint finds it. This is why it outranks a louder failure of the same impact.
- **Reversibility:** hard. The email is already sent and the status already flipped. Reversing this needs a money movement, not a code rollback.

The skill raises open questions — is this flag-gated? What reconciles gateway refunds against order status today? — without answering them. It does not re-flag the testability smells or invent a rollback plan.

## It's Working If

- A silent failure always ranks above a loud failure of the same impact, because a loud one gets fixed fast and a silent one runs unnoticed.
- Reversibility surfaces as an open question when the skill has no way to see the deploy pipeline — it never invents a rollback plan.
- The output never re-flags testability smells (that's [`qa-review`](./qa-review.md)'s job) or coverage gaps (that's [`coverage-review`](./coverage-review.md)'s job).
- A change with no real blast radius — an isolated internal script — gets said plainly, not padded with manufactured risk.

If `threat-model` ever invents a rollback plan, or ranks by probability instead of detectability weighted by impact, that is a bug — file it. See [Contributing & Support](../README.md#contributing--support).

## FAQ

**Q: Does threat-model confirm that a risk is real?**
A: No — this is reasoning, not verification. It flags what could go wrong and how detectable it would be; it does not run code or prove anything.

**Q: Why does a silent failure outrank a louder one with the same impact?**
A: Because a loud failure gets fixed fast, and a silent one runs in production, unfixed, until someone else finds it. Detectability weights the ranking as much as impact does.

**Q: Does threat-model tell me how to roll back?**
A: No — it flags reversibility as an open question. It has no way to see your deploy pipeline, so it will not invent a plan.

## Where it fits

`threat-model` runs independently of the [`qa-pass`](./qa-pass.md) chain. What breaks in production is a separate question from whether the tests are solid, which is the question that chain answers. `/qa-pass` never calls `threat-model`. Pair it with [`qa-review`](./qa-review.md) on a risky change: `qa-review` asks whether the code is testable, `threat-model` asks what happens if it is wrong.

## Anti-patterns

- **Ranking by probability instead of detectability times impact.** A silent failure you think is unlikely still outranks a loud one, because if it happens, nobody notices.
- **Inventing a rollback plan.** Reversibility stays an open question. The skill has no way to see your deploy pipeline.
- **Manufacturing risk to fill the template.** If a change touches nothing with real blast radius, for example an isolated internal script, say so plainly.
- **Re-flagging testability.** Non-determinism and hard-coded values belong to [`qa-review`](./qa-review.md), not to this skill.
