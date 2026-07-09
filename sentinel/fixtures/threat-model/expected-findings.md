# Expected findings — threat-model / refund.js

Run: `/threat-model sentinel/fixtures/threat-model/refund.js`

## What This Touches (skill should enumerate)
- **Data:** writes `status: 'refunded'` to the orders table.
- **External systems:** payment gateway (refund), email service (customer notification).
- **Downstream dependents:** anything reading order status — reporting, reconciliation,
  customer-facing order history.

## Top-ranked risk (should be HIGH, and ranked first for low detectability)
**Silent refund failure with recorded success.** The `paymentGateway.refund(...)` call is not
awaited or error-checked, but the order is marked `refunded` and the customer is emailed anyway.
- **Failure mode:** gateway call fails/rejects; money is never returned, yet the system records
  a completed refund. State and reality diverge.
- **Blast radius:** every refund path → all customers requesting refunds; corrupts downstream
  reporting/reconciliation that trusts order status. (See GLOSSARY: Blast Radius.)
- **Detectability:** low / silent — no error surfaces, the confirmation email already went out,
  the DB says success. Found only via manual reconciliation or customer complaints.
  (See GLOSSARY: Silent Failure.) This is why it should outrank a louder, same-impact failure.
- **Reversibility:** hard — the confirmation email is already sent and the status already
  flipped; unwinding requires reconciling money movement, not a code rollback.

## Open questions the skill should raise (not answer)
- Is the refund path flag-gated / can this change be rolled back independently?
- What actually reconciles gateway refunds against order status today?

## Boundary notes (what the skill should NOT do)
- It should NOT re-flag testability smells (that's `qa-review`) — scope is consequence only.
- It should NOT invent a specific rollback plan; reversibility is raised as a question.
