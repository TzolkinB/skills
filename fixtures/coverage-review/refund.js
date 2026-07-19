// Code under test for the coverage-review fixture.
// Small but branchy: guards, an error path, a state check, and a boundary.

function processRefund(order, amount) {
  if (amount <= 0) {
    throw new Error('amount must be positive');
  }
  if (amount > order.total) {
    throw new Error('amount exceeds order total');
  }
  if (order.status === 'refunded') {
    return { ok: false, reason: 'already refunded' };
  }

  const remaining = order.total - amount;
  const status = remaining === 0 ? 'refunded' : 'partial'; // boundary at remaining === 0
  return { ok: true, status, remaining };
}

module.exports = { processRefund };
