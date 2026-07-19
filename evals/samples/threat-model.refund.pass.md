<!-- RECORDED SAMPLE — a faithful /threat-model run on the fire-and-forget refund.js. Enumerates
     what the change touches, then ranks the SILENT refund failure HIGH and first — low
     detectability outranks a louder same-impact failure — and raises reversibility as an open
     question. Used by run-eval.mjs --dry-run offline. Deliberately stays in the consequence lane:
     it does NOT re-flag testability / mockability (that's /qa-review) and does NOT prescribe the
     code fix or a rollback plan, so the must_not checks read as correctly absent. -->

## Threat Model: refund.js (fire-and-forget refund)

### What This Touches
- Data: writes `status: 'refunded'` to the orders table.
- External systems: payment gateway (`paymentGateway.refund`), email service (customer notification).
- Downstream dependents: anything reading order status — reporting, reconciliation, customer order history.

### Risks (ranked)

**HIGH — silent refund failure with recorded success**
- Failure mode: `paymentGateway.refund(...)` is not awaited or error-checked, yet the order is marked `refunded` and the customer is emailed regardless. If the gateway call fails, money is never returned but the system records a completed refund — state and reality diverge.
- Blast radius: every refund path → all customers requesting refunds; corrupts downstream reporting/reconciliation that trusts order status.
- Detectability: low / silent — no error surfaces, the confirmation email already went out, the DB says success. Found only via manual reconciliation or a customer complaint. This is why it outranks a louder, same-impact failure.
- Reversibility: hard — the confirmation email is already sent and the status already flipped; unwinding means reconciling money movement, not a code rollback.

### Open Questions (for the developer, not answered here)
- Is the refund path flag-gated / can this change be rolled back independently?
- What reconciles gateway refunds against order status today?
