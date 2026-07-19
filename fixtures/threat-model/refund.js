// KNOWN-BAD INPUT for /threat-model
// The change under review: make refunds "fire-and-forget" to speed up the endpoint.
// The gateway call is no longer awaited or error-checked, yet the order is marked
// refunded and the customer is emailed regardless. This is testable and could even
// be tested — the point of threat-model is the CONSEQUENCE if it's wrong, not coverage.
// Run: `/threat-model fixtures/threat-model/refund.js`

async function issueRefund(order) {
  // fire-and-forget: no await, no result check, no error handling
  paymentGateway.refund(order.chargeId, order.total);

  // ...but we still record success and notify the customer:
  await db.orders.update(order.id, { status: 'refunded' }); // downstream reporting reads this
  await emailService.send(order.email, 'Your refund is on the way'); // irreversible side effect
}

module.exports = { issueRefund };
